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
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import Layout from '../../components/layout/Layout';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
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

      const response = await axios.get('/users');
      setUsers(response.data || []);
    } catch (err) {
      showToast('Error loading user accounts.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [showToast]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password.trim()) {
      showToast('All fields are required.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post('/users', {
        name,
        email,
        password,
        role,
        organization_id: currentAdmin?.organization_id,
      });

      showToast('User created successfully!', 'success');
      setCreateOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      setRole('client');
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to create user account.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUserForDelete) return;
    setDeleting(true);
    try {
      await deleteUser(selectedUserForDelete.id);
      showToast(`User "${selectedUserForDelete.name}" deleted successfully.`, 'success');
      setSelectedUserForDelete(null);
      fetchUsers();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to delete user account.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Layout>
      <Box sx={{ mb: 4, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
            User Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Provision and manage user accounts for developers and clients inside your organization.
          </Typography>
        </Box>
        <Button variant="contained" color="secondary" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>
          Add User
        </Button>
      </Box>

      {loading ? (
        <Skeleton variant="rectangular" height={300} sx={{ borderRadius: 3 }} />
      ) : users.length === 0 ? (
        <EmptyState
          title="No Users Added"
          description="There are no other user accounts in your organization. Click the 'Add User' button to create one."
          actionLabel="Add User"
          onAction={() => setCreateOpen(true)}
        />
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table aria-label="users-table">
            <TableHead sx={{ bgcolor: 'action.hover' }}>
              <TableRow>
                <TableCell><strong>Name</strong></TableCell>
                <TableCell><strong>Email</strong></TableCell>
                <TableCell><strong>Role</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell align="right"><strong>User ID</strong></TableCell>
                <TableCell align="center"><strong>Actions</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => {
                const isSelf = u.id === currentAdmin?.id;
                return (
                  <TableRow key={u.id}>
                    <TableCell sx={{ fontWeight: 600 }}>{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{getRoleLabel(u.role)}</TableCell>
                    <TableCell>
                      <Badge label={u.is_active ? 'Active' : 'Suspended'} type={u.is_active ? 'feature' : 'change-request'} />
                    </TableCell>
                    <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{u.id}</TableCell>
                    <TableCell align="center">
                      <Tooltip title={isSelf ? 'Cannot delete your own account' : 'Delete user account'}>
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={isSelf}
                            onClick={() => setSelectedUserForDelete(u)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create User Dialog */}
      <Dialog open={createOpen} onClose={() => !submitting && setCreateOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add New User Account</DialogTitle>
        <Box component="form" onSubmit={handleCreateUser}>
          <DialogContent dividers>
            <Stack spacing={3}>
              <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
              <Input label="Email Address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              <Input
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

      {/* Delete User Confirmation Dialog */}
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
