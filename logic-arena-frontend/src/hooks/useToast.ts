import { useCallback, useContext } from 'react';
import { ToastContext } from '../components/layout/ToastProvider';

export function useToast() {
  const ctx = useContext(ToastContext);
  return useCallback(
    (message: string, type: 'info' | 'error' = 'info') => {
      ctx?.show(message, type);
    },
    [ctx]
  );
}
