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
} from '@mui/material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { registerUser } from '../../api/auth';
import { useToastStore } from '../../store/toastStore';
import SmartToyIcon from '@mui/icons-material/SmartToy';

export const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('client');
  const [orgId, setOrgId] = useState('');
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
        role,
        organization_id: orgId.trim() || null,
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
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }} align="center">
            Create your account on ReqSense AI
          </Typography>

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
              
              <FormControl component="fieldset">
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

              <Input
                label="Organization ID (Optional UUID)"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                placeholder="Leave blank to create a new organization scope"
              />

              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                size="large"
                loading={loading}
              >
                Register Account
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
