import React, { useState } from 'react';
import {
  Box,
  Typography,
  Container,
  Paper,
  Link,
  Stack,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
} from '@mui/material';
import { useNavigate, Link as RouterLink, useSearchParams } from 'react-router-dom';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { registerUser } from '../../api/auth';
import { useToastStore } from '../../store/toastStore';
import SmartToyIcon from '@mui/icons-material/SmartToy';

export const Register = () => {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite') || '';
  const inviteOrg = searchParams.get('org') || '';
  const inviteRole = searchParams.get('role') || 'client';
  const inviteEmail = searchParams.get('email') || '';
  const isInviteFlow = Boolean(inviteToken);

  const [name, setName] = useState('');
  const [email, setEmail] = useState(inviteEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState(isInviteFlow ? inviteRole : 'client');
  const [orgId, setOrgId] = useState(inviteOrg);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const showToast = useToastStore((state) => state.showToast);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) {
      showToast('Please fill in all fields.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return;
    }

    if (password.length < 8) {
      showToast('Password must be at least 8 characters long.', 'error');
      return;
    }

    setLoading(true);
    try {
      await registerUser({
        name,
        email,
        password,
        role: isInviteFlow ? inviteRole : role,
        organization_id: (isInviteFlow ? inviteOrg : orgId).trim() || null,
        invite_token: inviteToken || null,
      });

      showToast('Registration successful! Please check your email to verify.', 'success');
      navigate('/login');
    } catch (err) {
      const errorMsg = err.response?.data?.detail || 'Registration failed. Please try again.';
      showToast(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          py: 4,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: '100%',
            borderRadius: 3,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Box
            sx={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              bgcolor: 'primary.main',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mb: 2,
            }}
          >
            <SmartToyIcon />
          </Box>
          
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Register
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }} align="center">
            {isInviteFlow
              ? 'Complete signup to join the project you were invited to.'
              : 'Create your account on ReqSense AI'}
          </Typography>

          <Alert severity="info" sx={{ width: '100%', mb: 2 }}>
            Each email address has one role (client, developer, or admin).
            If you need both client and developer access, register with two emails
            (for example name+dev@ and name+client@).
          </Alert>

          {isInviteFlow && (
            <Alert severity="success" sx={{ width: '100%', mb: 2 }}>
              You were invited as a <strong>{inviteRole}</strong>. Your account will be
              attached to the project automatically after signup.
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
            <Stack spacing={2.5}>
              <Input
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <Input
                label="Email Address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={isInviteFlow && Boolean(inviteEmail)}
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                helperText="Min 8 characters, with 1 uppercase letter and 1 digit"
                required
              />
              <Input
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              
              <FormControl component="fieldset" disabled={isInviteFlow}>
                <FormLabel component="legend" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Register As
                </FormLabel>
                <RadioGroup
                  aria-label="role"
                  name="role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  row
                >
                  <FormControlLabel value="client" control={<Radio />} label="Client" />
                  <FormControlLabel value="developer" control={<Radio />} label="Developer" />
                  <FormControlLabel value="admin" control={<Radio />} label="Organization Admin" />
                </RadioGroup>
              </FormControl>

              {!isInviteFlow && (
                <Input
                  label="Organization ID (Optional UUID)"
                  value={orgId}
                  onChange={(e) => setOrgId(e.target.value)}
                  placeholder="Leave blank to create a new organization scope"
                />
              )}

              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                loading={loading}
              >
                {isInviteFlow ? 'Accept Invite & Register' : 'Register Account'}
              </Button>

              <Typography variant="body2" align="center" sx={{ mt: 1 }}>
                Already have an account?{' '}
                <Link component={RouterLink} to="/login" color="secondary" sx={{ fontWeight: 600 }}>
                  Sign In
                </Link>
              </Typography>
            </Stack>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Register;
