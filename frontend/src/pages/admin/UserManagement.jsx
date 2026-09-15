import React, { useEffect, useState } from 'react';
import {
  Typography,
  Box,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  IconButton,
  Tooltip,
  TextField,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import Layout from '../../components/layout/Layout';
import Button from '../../components/common/Button';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import { getCurrentUser } from '../../api/auth';
import { deleteUser } from '../../api/users';
import { useToastStore } from '../../store/toastStore';
import { getRoleLabel } from '../../utils/helpers';
import axios from '../../api/axios';

export const UserManagement = () => {
  const showToast = useToastStore((state) => state.showToast);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('client');
  const [submitting, setSubmitting] = useState(false);

  const [selectedUserForDelete, setSelectedUserForDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const adminProfile = await getCurrentUser();
      setCurrentAdmin(adminProfile);
      const res = await axios.get('/users');
      const userList = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setUsers(userList);
    } catch (err) {
      console.error('[UserManagement] Failed to load users:', err);
      showToast('Error loading user list.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      await axios.post('/users', {
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      });
      showToast('User created successfully.', 'success');
      setCreateOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      setRole('client');
      fetchUsers();
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to create user.';
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUserForDelete) return;
    try {
      setDeleting(true);
      await deleteUser(selectedUserForDelete.id);
      showToast('User removed successfully.', 'success');
      setSelectedUserForDelete(null);
      fetchUsers();
    } catch (err) {
      const msg = err.response?.data?.detail || err.response?.data?.message || 'Failed to delete user.';
      showToast(msg, 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 0.5 }}>
            User Management
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            Provision and manage client and developer credentials.
          </Typography>
        </Box>
        <Button variant="primary" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Add User
        </Button>
      </Stack>

      <TableContainer component={Paper} sx={{ borderRadius: 3, border: '1px solid #E2E8F0', boxShadow: 'none' }}>
        <Table>
          <TableHead sx={{ bgcolor: '#F8FAFC' }}>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Name</TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Email</TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Role</TableCell>
              <TableCell sx={{ fontWeight: 700, color: '#475569' }}>Created At</TableCell>
              <TableCell align="right" sx={{ fontWeight: 700, color: '#475569' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell><Skeleton variant="text" /></TableCell>
                  <TableCell><Skeleton variant="text" /></TableCell>
                  <TableCell><Skeleton variant="rectangular" width={60} height={24} sx={{ borderRadius: 2 }} /></TableCell>
                  <TableCell><Skeleton variant="text" /></TableCell>
                  <TableCell align="right"><Skeleton variant="circular" width={32} height={32} sx={{ ml: 'auto' }} /></TableCell>
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                  <EmptyState title="No users found" description="Create a new user account to get started." />
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{u.name}</TableCell>
                  <TableCell sx={{ color: 'text.secondary' }}>{u.email}</TableCell>
                  <TableCell>
                    <Badge
                      label={getRoleLabel(u.role)}
                      variant={u.role === 'admin' ? 'purple' : u.role === 'developer' ? 'blue' : 'gray'}
                    />
                  </TableCell>
                  <TableCell sx={{ color: 'text.secondary', fontSize: '0.875rem' }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    {currentAdmin?.id !== u.id && (
                      <Tooltip title="Delete User">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => setSelectedUserForDelete(u)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {}
      <Dialog open={createOpen} onClose={() => !submitting && setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add New User Account</DialogTitle>
        <Box component="form" onSubmit={handleCreateUser}>
          <DialogContent dividers>
            <Stack spacing={3}>
              <TextField fullWidth label="Full Name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              <TextField fullWidth label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <TextField
                fullWidth
                label="Temporary Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                helperText="Must be min 8 chars with 1 uppercase and 1 digit"
              />
              <FormControl fullWidth>
                <InputLabel id="role-label">System Role</InputLabel>
                <Select labelId="role-label" value={role} label="System Role" onChange={(e) => setRole(e.target.value)}>
                  <MenuItem value="client">Client</MenuItem>
                  <MenuItem value="developer">Developer</MenuItem>
                </Select>
              </FormControl>
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button disabled={submitting} onClick={() => setCreateOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button type="submit" variant="contained" color="primary" loading={submitting}>
              Create Account
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {}
      <Dialog open={Boolean(selectedUserForDelete)} onClose={() => !deleting && setSelectedUserForDelete(null)}>
        <DialogTitle sx={{ fontWeight: 700 }}>Delete User Account</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete user <strong>"{selectedUserForDelete?.name}"</strong> ({selectedUserForDelete?.email})? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedUserForDelete(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDeleteUser} color="error" variant="contained" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete User'}
          </Button>
        </DialogActions>
      </Dialog>
    </Layout>
  );
};

export default UserManagement;
