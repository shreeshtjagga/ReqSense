import { create } from 'zustand';

export const useToastStore = create((set) => ({
  open: false,
  message: '',
  severity: 'info', // 'success' | 'info' | 'warning' | 'error'
  duration: 4000,
  
  showToast: (message, severity = 'info', duration = 4000) =>
    set({ open: true, message, severity, duration }),
    
  hideToast: () => set({ open: false }),
}));
