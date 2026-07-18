import { useState, useEffect, useCallback } from 'react';
import { listSessionsForProject, getSession } from '../api/sessions';
import { useToastStore } from '../store/toastStore';

export const useSession = (projectId = null, sessionId = null) => {
  const [sessions, setSessions] = useState([]);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const showToast = useToastStore((state) => state.showToast);

  const fetchSessions = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await listSessionsForProject(projectId);
      setSessions(data);
    } catch (e) {
      showToast('Error loading session records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, showToast]);

  const fetchSession = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const data = await getSession(sessionId);
      setSession(data);
    } catch (e) {
      showToast('Error loading session details.', 'error');
    } finally {
      setLoading(false);
    }
  }, [sessionId, showToast]);

  useEffect(() => {
    if (projectId) fetchSessions();
  }, [projectId, fetchSessions]);

  useEffect(() => {
    if (sessionId) fetchSession();
  }, [sessionId, fetchSession]);

  return {
    sessions,
    session,
    loading,
    refreshSessions: fetchSessions,
    refreshSession: fetchSession,
  };
};

export default useSession;
