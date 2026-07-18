import React, { useEffect, useState } from 'react';
import {
  Typography,
  Grid,
  Box,
  Alert,
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
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import Layout from '../../components/layout/Layout';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import EmptyState from '../../components/common/EmptyState';
import Badge from '../../components/common/Badge';
import { getCurrentUser } from '../../api/auth';
import { useToastStore } from '../../store/toastStore';
import { getRoleLabel } from '../../utils/helpers';
import axios from '../../api/axios'; // Direct API requests for admin CRUD

export const UserManagement = () => {
  const showToast = useToastStore((state) => state.showToast);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState(null);

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('client');
  const [submitting, setSubmitting] = useState(false);

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

  return (
    <Layout>
      <Box sx={{ mb: 4, display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 1 }}>
            User Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Provision user accounts for developers and clients scoped inside your organization.
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
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell sx={{ fontWeight: 600 }}>{u.name}</TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{getRoleLabel(u.role)}</TableCell>
                  <TableCell>
                    <Badge label={u.is_active ? 'Active' : 'Suspended'} type={u.is_active ? 'feature' : 'change-request'} />
                  </TableCell>
                  <TableCell align="right" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{u.id}</TableCell>
                </TableRow>
              ))}
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
    </Layout>
  );
};

export default UserManagement;
