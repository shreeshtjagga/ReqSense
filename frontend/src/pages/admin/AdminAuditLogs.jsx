import React, { useEffect, useState, useCallback } from 'react';
import {
  Typography,
  Box,
  Skeleton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  TextField,
  InputAdornment,
  Tooltip,
  IconButton,
} from '@mui/material';
import Layout from '../../components/layout/Layout';
import EmptyState from '../../components/common/EmptyState';
import { useToastStore } from '../../store/toastStore';
import { formatDateTime } from '../../utils/helpers';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import api from '../../api/axios';

export const AdminAuditLogs = () => {
  const showToast = useToastStore((s) => s.showToast);

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/audit-logs', { params: { limit: 100 } });
      setLogs(res.data || []);
    } catch (err) {
      showToast('Failed to load audit logs.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filtered = logs.filter((log) => {
    const q = search.toLowerCase();
    return (
      !q ||
      log.event_summary?.toLowerCase().includes(q) ||
      log.action?.toLowerCase().includes(q) ||
      log.actor_name?.toLowerCase().includes(q) ||
      log.actor_email?.toLowerCase().includes(q) ||
      log.entity_label?.toLowerCase().includes(q)
    );
  });

  return (
    <Layout>
      {/* Header */}
      <Box sx={{ mb: 3.5, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#0F172A', mb: 0.5 }}>
            Audit Logs
          </Typography>
          <Typography variant="body2" color="text.secondary">
            System activity and user access history.
          </Typography>
        </Box>
        <Tooltip title="Refresh Logs">
          <IconButton onClick={fetchLogs} disabled={loading} size="small" sx={{ bgcolor: '#F8FAFC', border: '1px solid #E2E8F0' }}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Simple Search Bar */}
      <Box sx={{ mb: 2.5 }}>
        <TextField
          size="small"
          placeholder="Search activity by user or event…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: '#64748B' }} />
              </InputAdornment>
            ),
          }}
          sx={{ maxWidth: 420, bgcolor: '#FFFFFF' }}
        />
      </Box>

      {/* Clean Table */}
      {loading ? (
        <Stack spacing={1.5}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 2 }} />
          ))}
        </Stack>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Logs Found"
          description="No activity logs matched your search."
        />
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Table size="small" aria-label="audit-logs-table">
            <TableHead sx={{ bgcolor: '#F8FAFC' }}>
              <TableRow>
                <TableCell sx={{ py: 1.5 }}><strong>Activity</strong></TableCell>
                <TableCell sx={{ py: 1.5 }}><strong>Actor</strong></TableCell>
                <TableCell sx={{ py: 1.5 }} align="right"><strong>Date &amp; Time</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((log) => (
                <TableRow key={log.id} hover sx={{ '&:last-child td, &:last-child th': { border: 0 } }}>
                  {/* Activity Summary */}
                  <TableCell sx={{ py: 1.5 }}>
                    <Typography variant="body2" sx={{ color: '#1E293B', fontWeight: 500, fontSize: '0.85rem' }}>
                      {log.event_summary || (log.action ? log.action.replace(/_/g, ' ') : 'System Event')}
                    </Typography>
                  </TableCell>

                  {/* Actor */}
                  <TableCell sx={{ py: 1.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#0F172A', fontSize: '0.85rem' }}>
                      {log.actor_name || 'System'}
                    </Typography>
                    {log.actor_email && (
                      <Typography variant="caption" sx={{ color: '#64748B', display: 'block', fontSize: '0.72rem' }}>
                        {log.actor_email}
                      </Typography>
                    )}
                  </TableCell>

                  {/* Date & Time */}
                  <TableCell sx={{ py: 1.5 }} align="right">
                    <Typography variant="caption" sx={{ color: '#475569', fontWeight: 500, whiteSpace: 'nowrap' }}>
                      {formatDateTime(log.created_at)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
        Showing {filtered.length} of {logs.length} events
      </Typography>
    </Layout>
  );
};

export default AdminAuditLogs;
