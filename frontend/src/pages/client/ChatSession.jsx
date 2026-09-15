import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Typography, Box, Alert, Button, Grid, Stack, Divider, Paper, Skeleton, Chip } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../../components/layout/Layout';
import ChatWindow from '../../components/chat/ChatWindow';
import { getSession, endSession } from '../../api/sessions';
import { listMessages, createMessage } from '../../api/messages';
import { getProject } from '../../api/projects';
import { resolveContradiction } from '../../api/contradictions';
import { useToastStore } from '../../store/toastStore';
import { useAuthStore } from '../../store/authStore';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import StopIcon from '@mui/icons-material/Stop';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

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
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState(null);

  const pollingIntervalRef = useRef(null);
  const sessionRef = useRef(session);
  const sendingRef = useRef(false);

  useEffect(() => { sessionRef.current = session; }, [session]);

  const fetchSessionAndMessages = useCallback(async () => {
    if (!sessionId) return;
    try {
      const [sessionData, msgs] = await Promise.all([
        getSession(sessionId),
        listMessages(sessionId),
      ]);

      setSession(sessionData);

      if (!sendingRef.current) {
        setMessages(Array.isArray(msgs) ? msgs : []);
      }

      if (sessionData?.project_id && !project) {
        try {
          const proj = await getProject(sessionData.project_id);
          setProject(proj);
        } catch {

        }
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Could not load requirements gathering session.';
      setError(detail);
      showToast('Error loading session details.', 'error');
    } finally {
      setLoading(false);
    }
  }, [sessionId, showToast]);

  useEffect(() => {

    setSession(null);
    setProject(null);
    setMessages([]);
    setError(null);
    setLoading(true);
    sendingRef.current = false;
    setSending(false);

    fetchSessionAndMessages();

    pollingIntervalRef.current = setInterval(() => {
      if (
        sessionRef.current?.status === 'active' &&
        document.visibilityState === 'visible' &&
        !sendingRef.current
      ) {
        listMessages(sessionId)
          .then((msgs) => {
            if (!sendingRef.current && Array.isArray(msgs)) {
              setMessages((prev) => {
                if (
                  prev.length !== msgs.length ||
                  (msgs.length > 0 && prev[prev.length - 1]?.id !== msgs[msgs.length - 1]?.id)
                ) {
                  return msgs;
                }
                return prev;
              });
            }
          })
          .catch((e) => console.warn('Polling error (non-fatal):', e));
      }
    }, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [sessionId, fetchSessionAndMessages]);

  const handleSendMessage = async (content) => {
    if (!content?.trim()) return;

    const tempClientMsg = {
      id: `temp-${Date.now()}`,
      sender: 'client',
      content,
      message_type: 'normal',
      created_at: new Date().toISOString(),
    };

    sendingRef.current = true;
    setSending(true);
    setMessages((prev) => [...prev, tempClientMsg]);

    try {
      await createMessage(sessionId, {
        content,
        sender: 'client',
        message_type: 'normal',
      });

      const updatedMsgs = await listMessages(sessionId);
      setMessages(Array.isArray(updatedMsgs) ? updatedMsgs : []);
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Failed to send requirement. Please try again.';
      showToast(detail, 'error');

      setMessages((prev) => prev.filter((m) => m.id !== tempClientMsg.id));
      throw err;
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleEndSession = async () => {
    if (ending) return;
    setEnding(true);
    try {
      const res = await endSession(sessionId, 'completed');
      showToast('Gathering session ended successfully! Requirements saved for engineering review.', 'success');
      const projectId = session?.project_id;
      if (projectId) {
        navigate(`/client/projects/${projectId}`);
      } else {
        navigate('/');
      }
    } catch (err) {
      const detail = err?.response?.data?.detail || 'Failed to end the session.';
      showToast(detail, 'error');
    } finally {
      setEnding(false);
    }
  };

  const handleResolveConflict = async (contradiction) => {
    const contradictionId = contradiction?.contradiction_id;
    if (!contradictionId) {
      showToast('Cannot resolve — contradiction ID is missing.', 'error');
      return;
    }
    try {
      await resolveContradiction(contradictionId, {
        action: 'resolved',
        resolution: 'Resolved directly from chat session.',
      });
      showToast('Contradiction marked as resolved.', 'success');
      const updatedMsgs = await listMessages(sessionId);
      setMessages(Array.isArray(updatedMsgs) ? updatedMsgs : []);
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

  const isActive = session?.status === 'active';
  const canChat = Boolean(isActive);

  return (
    <Layout>
      <Grid
        container
        spacing={3}
        sx={{
          height: { xs: 'auto', md: 'calc(100vh - 140px)' },
          minHeight: 0,
          flexGrow: 1,
        }}
      >
        {}
        <Grid
          item
          xs={12}
          md={3}
          sx={{ display: 'flex', flexDirection: 'column', height: { xs: 'auto', md: '100%' } }}
        >
          <Stack spacing={2} sx={{ height: '100%' }}>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<ArrowBackIcon />}
              onClick={() => session?.project_id ? navigate(`/client/projects/${session.project_id}`) : navigate('/')}
              sx={{ alignSelf: 'flex-start' }}
            >
              Back to Project
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
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={session?.status || 'unknown'}
                      color={isActive ? 'success' : 'default'}
                      size="small"
                      sx={{ fontWeight: 700, textTransform: 'capitalize' }}
                    />
                  </Box>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">Total Requirements Exchanged</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, color: 'primary.main' }}>
                    {session?.total_messages || messages.length || 0}
                  </Typography>
                </Box>

                <Box>
                  <Typography variant="caption" color="text.secondary">ARIA Assistant</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                    <AutoAwesomeIcon color={isActive ? 'primary' : 'disabled'} fontSize="small" />
                    {isActive ? 'Active & Listening' : 'Session Completed'}
                  </Typography>
                </Box>
              </Stack>
            </Paper>

            {isActive && (
              <Box sx={{ mt: 4 }}>
                <Button
                  fullWidth
                  variant="contained"
                  color="secondary"
                  startIcon={<StopIcon />}
                  onClick={handleEndSession}
                  disabled={ending}
                  sx={{ py: 1.2, fontWeight: 700 }}
                >
                  {ending ? 'Finishing Session…' : 'End Gathering Session'}
                </Button>
              </Box>
            )}
          </Stack>
        </Grid>

        {}
        <Grid
          item
          xs={12}
          md={9}
          sx={{
            display: 'flex',
            flexDirection: 'column',
            height: { xs: '600px', md: '100%' },
            minHeight: 0,
          }}
        >
          {error ? (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={fetchSessionAndMessages}>
                  Retry
                </Button>
              }
            >
              {error}
            </Alert>
          ) : (
            <ChatWindow
              messages={messages}
              sending={sending}
              loading={loading}
              onSendMessage={handleSendMessage}
              onResolveConflict={handleResolveConflict}
              disabled={!canChat}
              title={`Gathering session for ${project?.name || 'Project'}`}
            />
          )}
        </Grid>
      </Grid>
    </Layout>
  );
};

export default ChatSession;
