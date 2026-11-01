import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';

/** A mutation that refreshes the listed queries, confirms with a toast and reports errors. */
export function useAdminMutation(mutationFn, { success, invalidate = [], onDone, quietErrors = false } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result, variables) => {
      for (const key of invalidate) queryClient.invalidateQueries({ queryKey: [key] });
      if (success) toast.success(typeof success === 'function' ? success(result, variables) : success);
      onDone?.(result, variables);
    },
    onError: (error) => {
      if (!quietErrors) toast.error(error.message);
    },
  });
}

export function CheckField({ label, checked, onChange }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}
