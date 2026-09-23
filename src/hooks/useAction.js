import { useCallback } from 'react';
import { useStore } from '../store/useStore';

/**
 * Confirm + toast helper hook: wraps store actions with error → toast.
 * Usage: const run = useAction(); run(() => store.addCustomer(data), 'Customer created');
 */
export function useAction() {
  const pushToast = useStore((s) => s.pushToast);
  return useCallback(
    (fn, successMessage) => {
      try {
        const result = fn();
        if (successMessage) pushToast(successMessage, 'success');
        return result;
      } catch (err) {
        pushToast(err?.message ?? 'Something went wrong', 'error');
        return undefined;
      }
    },
    [pushToast]
  );
}
