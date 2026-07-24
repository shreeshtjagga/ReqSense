import React, { useState } from 'react';
import { TextField, IconButton, InputAdornment } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';

export const Input = ({
  type = 'text',
  error = false,
  helperText = '',
  startIcon = null,
  ...props
}) => {
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const togglePasswordVisibility = () => {
    setShowPassword((prev) => !prev);
  };

  const startAdornment = startIcon ? (
    <InputAdornment position="start">{startIcon}</InputAdornment>
  ) : null;

  const endAdornment = isPassword ? (
    <InputAdornment position="end">
      <IconButton
        aria-label="toggle password visibility"
        onClick={togglePasswordVisibility}
        edge="end"
        size="small"
      >
        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
      </IconButton>
    </InputAdornment>
  ) : null;

  return (
    <TextField
      type={inputType}
      error={error}
      helperText={helperText}
      fullWidth
      slotProps={{
        input: {
          startAdornment,
          endAdornment,
        },
      }}
      {...props}
    />
  );
};

export default Input;
