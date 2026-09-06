import React, { useEffect, useState, useRef } from 'react';
import { Typography, Box, Alert, Button, Grid, Stack, Divider, Paper, Skeleton } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import ChatWindow from '../../components/chat/ChatWindow';
import { getSession, endSession, listAllProjectMessages } from '../../api/sessions';
import { listMessages, createMessage } from '../../api/messages';
import { getProject } from '../../api/projects';
import { resolveContradiction } from '../../api/contradictions';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StopIcon from '@mui/icons-material/Stop';
import SmartToyIcon from '@mui/icons-material/SmartToy';

export const ChatSession = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);
  const { user } = useAuthStore();

  const [session, setSession] = useState(null);
  const [project, setProject] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const pollingIntervalRef = useRef(null);
  const sessionRef = useRef(session);
  useEffect(() => { sessionRef.current = session; }, [session]);


  const fetchSessionAndMessages = async () => {
    try {
      const sessionData = await getSession(sessionId);
      setSession(sessionData);

      let msgs;
      try {
        msgs = sessionData?.project_id
          ? await listAllProjectMessages(sessionData.project_id)
          : await listMessages(sessionId);
      } catch {
        msgs = await listMessages(sessionId);
      }
      setMessages(msgs);

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

    pollingIntervalRef.current = setInterval(() => {
      if (sessionRef.current?.status === 'active' && document.visibilityState === 'visible') {
        const fetchFn = sessionRef.current?.project_id
          ? () => listAllProjectMessages(sessionRef.current.project_id)
          : () => listMessages(sessionId);
        fetchFn()
          .then((msgs) => setMessages(msgs))
          .catch((e) => console.error('Error polling messages:', e));
      }
    }, 8000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [sessionId]);

  const handleSendMessage = async (content) => {
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
      await createMessage(sessionId, {
        content,
        sender: 'client',
        message_type: 'normal',
      });

      const updatedMsgs = await listMessages(sessionId);
      setMessages(updatedMsgs);
    } catch (err) {
      showToast('Failed to send requirement. Please try again.', 'error');
      setMessages((prev) => prev.filter((m) => m.id !== tempClientMsg.id));
      throw err; // re-throw so ChatInput's .catch() keeps the text
    } finally {
      setSending(false);
    }
  };

  const handleEndSession = async () => {
    try {
      setLoading(true);
      const res = await endSession(sessionId, 'completed');
      if (res?.srs_status === 'failed' || res?.srs_status === 'queued') {
        showToast('Session ended. SRS generation is queued/delayed — generate manually in Project SRS tab.', 'warning');
      } else {
        showToast('Session ended. Your SRS document was generated successfully!', 'success');
      }
      if (session?.project_id) {
        navigate(`/client/projects/${session.project_id}`);
      } else {
        navigate('/');
      }
    } catch (err) {
      showToast('Failed to end the session.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleResolveConflict = async (contradiction) => {
    const contradictionId = contradiction?.contradiction_id;
    if (!contradictionId) {
      showToast('Cannot resolve — contradiction ID is missing.', 'error');
      return;
    }
    try {
      await resolveContradiction(contradictionId, { action: 'resolved', resolution: 'Resolved directly from chat session.' });
      showToast('Contradiction marked as resolved.', 'success');
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
                End Chat
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
              disabled={session?.status !== 'active' || user?.role !== 'client'}
              title={`Gathering session for ${project?.name || 'Project'}`}
            />
          )}
        </Grid>
      </Grid>
    </Layout>
  );
};

export default ChatSession;
