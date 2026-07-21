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
  Chip,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import Layout from '../../components/layout/Layout';
import EmptyState from '../../components/common/EmptyState';
import { useToastStore } from '../../store/toastStore';
import { formatDateTime } from '../../utils/helpers';
import SearchIcon from '@mui/icons-material/Search';
import api from '../../api/axios';

const ACTION_COLORS = {
  login: 'info',
  logout: 'default',
  register: 'success',
  admin_create_user: 'warning',
  admin_update_user: 'warning',
  admin_delete_user: 'error',
  suspicious_input_flagged: 'error',
};

export const AdminAuditLogs = () => {
  const showToast = useToastStore((s) => s.showToast);

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState('');

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100, offset: 0 };
      if (entityTypeFilter) params.entity_type = entityTypeFilter;
      const res = await api.get('/audit-logs', { params });
      setLogs(res.data);
    } catch (err) {
      showToast('Failed to load audit logs.', 'error');
    } finally {
      setLoading(false);
    }
  }, [entityTypeFilter, showToast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filtered = logs.filter((log) => {
    const q = search.toLowerCase();
    return (
      !q ||
      log.action?.toLowerCase().includes(q) ||
      log.entity_type?.toLowerCase().includes(q) ||
      log.user_id?.toLowerCase().includes(q) ||
      log.entity_id?.toLowerCase().includes(q)
    );
  });

  // Get unique entity types for the filter dropdown
  const entityTypes = [...new Set(logs.map((l) => l.entity_type).filter(Boolean))];

  return (
    <Layout>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
          Audit Logs
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Immutable, append-only record of all privileged actions taken across
          the platform.
        </Typography>
      </Box>

      {/* Filters */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
        <TextField
          size="small"
          placeholder="Search by action, entity type, user ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ flexGrow: 1, maxWidth: 480 }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel id="entity-type-label">Entity Type</InputLabel>
          <Select
            labelId="entity-type-label"
            value={entityTypeFilter}
            label="Entity Type"
            onChange={(e) => setEntityTypeFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {entityTypes.map((t) => (
              <MenuItem key={t} value={t}>
                {t}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Stack>

      {loading ? (
        <Stack spacing={1.5}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} variant="rectangular" height={52} sx={{ borderRadius: 1.5 }} />
          ))}
        </Stack>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No Audit Log Entries"
          description="No audit events have been recorded yet, or your search/filter returned no results."
        />
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small" aria-label="audit-logs-table">
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell><strong>Action</strong></TableCell>
                <TableCell><strong>Entity Type</strong></TableCell>
                <TableCell><strong>Entity ID</strong></TableCell>
                <TableCell><strong>Actor User ID</strong></TableCell>
                <TableCell><strong>IP Address</strong></TableCell>
                <TableCell><strong>Timestamp</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered.map((log) => (
                <TableRow key={log.id} hover>
                  <TableCell>
                    <Chip
                      label={log.action}
                      size="small"
                      color={ACTION_COLORS[log.action] || 'default'}
                      variant="outlined"
                      sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {log.entity_type || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      sx={{ fontFamily: 'monospace', fontSize: '0.72rem' }}
                    >
                      {log.entity_id
                        ? `${log.entity_id.slice(0, 8)}…`
                        : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant="caption"
                      sx={{ fontFamily: 'monospace', fontSize: '0.72rem' }}
                    >
                      {log.user_id ? `${log.user_id.slice(0, 8)}…` : '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" color="text.secondary">
                      {log.ip_address || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption">
                      {formatDateTime(log.created_at)}
                    </Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Typography variant="caption" color="text.disabled" sx={{ mt: 2, display: 'block' }}>
        Showing {filtered.length} of {logs.length} entries (max 100 per page)
      </Typography>
    </Layout>
  );
};

export default AdminAuditLogs;
