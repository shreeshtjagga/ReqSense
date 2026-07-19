import React, { useEffect, useState, useRef } from 'react';
import { Typography, Box, Alert, Button, Grid, Stack, Divider, Paper, Skeleton } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import ChatWindow from '../../components/chat/ChatWindow';
import { getSession, endSession } from '../../api/sessions';
import { listMessages, createMessage } from '../../api/messages';
import { getProject } from '../../api/projects';
import { resolveContradiction } from '../../api/contradictions';
import { useToastStore } from '../../store/toastStore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StopIcon from '@mui/icons-material/Stop';
import SmartToyIcon from '@mui/icons-material/SmartToy';

export const ChatSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);

  const [session, setSession] = useState(null);
  const [project, setProject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const pollingIntervalRef = useRef(null);

  const fetchSessionAndMessages = async () => {
    try {
      const sessionData = await getSession(sessionId);
      setSession(sessionData);

      const msgs = await listMessages(sessionId);
      setMessages(msgs);

      // Fetch project details
      if (sessionData?.project_id) {
        const proj = await getProject(sessionData.project_id);
        setProject(proj);
      }
    } catch (err) {
      setError('Could not load requirements gathering session.');
      showToast('Error loading session details.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessionAndMessages();

    // Set up polling for new messages (e.g. system warnings or external changes)
    pollingIntervalRef.current = setInterval(() => {
      if (session?.status === 'active') {
        listMessages(sessionId)
          .then((msgs) => setMessages(msgs))
          .catch((e) => console.error('Error polling messages:', e));
      }
    }, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [sessionId]);

  const handleSendMessage = async (content) => {
    // Optimistically add client message
    const tempClientMsg = {
      id: `temp-${Date.now()}`,
      sender: 'client',
      content,
      message_type: 'normal',
      created_at: new Date().toISOString(),
    };
    
    setMessages((prev) => [...prev, tempClientMsg]);
    setSending(true);

    try {
      // Send message to backend (triggers AI response, atom extraction and contradiction check)
      await createMessage(sessionId, {
        content,
        sender: 'client',
        message_type: 'normal',
      });

      // Refetch messages to get both client message (sanitized) and ARIA's reply
      const updatedMsgs = await listMessages(sessionId);
      setMessages(updatedMsgs);
    } catch (err) {
      showToast('Failed to send requirement. Please try again.', 'error');
      // Rollback optimism
      setMessages((prev) => prev.filter((m) => m.id !== tempClientMsg.id));
    } finally {
      setSending(false);
    }
  };

  const handleEndSession = async () => {
    try {
      setLoading(true);
      await endSession(sessionId, 'completed');
      showToast('Session ended successfully! Generating SRS...', 'success');
      navigate('/');
    } catch (err) {
      showToast('Failed to end the session.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Handler wired from ChatWindow → ChatMessage → ConflictAlert → "Resolve Contradiction" button.
  // contradiction here is the parsed JSON from the conflict_alert message content:
  //   { contradiction_id, conflict_type, aria_message, confidence }
  const handleResolveConflict = async (contradiction) => {
    const contradictionId = contradiction?.contradiction_id;
    if (!contradictionId) {
      showToast('Cannot resolve — contradiction ID is missing.', 'error');
      return;
    }
    try {
      await resolveContradiction(contradictionId, { action: 'resolved', resolution: 'Resolved directly from chat session.' });
      showToast('Contradiction marked as resolved.', 'success');
      // Refetch messages so the conflict_alert bubble can be replaced/updated.
      const updatedMsgs = await listMessages(sessionId);
      setMessages(updatedMsgs);
    } catch (err) {
      showToast('Failed to resolve contradiction. Try from the Project Detail page.', 'error');
    }
  };

  if (loading && !session) {
    return (
      <Layout>
        <Box sx={{ py: 4 }}>
          <Stack spacing={2}>
            <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 2 }} />
            <Skeleton variant="rectangular" height={400} sx={{ borderRadius: 3 }} />
          </Stack>
        </Box>
      </Layout>
    );
  }

  return (
    <Layout>
      <Grid container spacing={3} sx={{ height: 'calc(100vh - 120px)' }}>
        {/* Left Side: Session Details Panel */}
        <Grid item xs={12} md={3} sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <Stack spacing={2} sx={{ height: '100%' }}>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/')}
              sx={{ alignSelf: 'flex-start' }}
            >
              Back to Dashboard
            </Button>
            
            <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, flexGrow: 1, overflowY: 'auto' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                Session Info
              </Typography>
              
              <Stack spacing={2} divider={<Divider />}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Project</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{project?.name || 'Loading...'}</Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">Status</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                    {session?.status}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">Stability Index</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {session?.stability_score ? `${Math.round(session.stability_score)}%` : '100%'}
                  </Typography>
                </Box>
                
                <Box>
                  <Typography variant="caption" color="text.secondary">Contradictions</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {session?.contradiction_events ?? 0}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            {session?.status === 'active' && (
              <Button
                variant="contained"
                color="error"
                startIcon={<StopIcon />}
                onClick={handleEndSession}
                fullWidth
                size="large"
              >
                End & Generate SRS
              </Button>
            )}
          </Stack>
        </Grid>

        {/* Right Side: Chat Window */}
        <Grid item xs={12} md={9} sx={{ height: '100%' }}>
          {error ? (
            <Alert severity="error">{error}</Alert>
          ) : (
            <ChatWindow
              messages={messages}
              sending={sending}
              onSendMessage={handleSendMessage}
              onResolveConflict={handleResolveConflict}
              disabled={session?.status !== 'active'}
              title={`Gathering session for ${project?.name || 'Project'}`}
            />
          )}
        </Grid>
      </Grid>
    </Layout>
  );
};

export default ChatSession;
