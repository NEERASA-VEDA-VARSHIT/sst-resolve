/**
 * Hook for optimistic UI updates
 * 
 * Updates UI immediately, then syncs with server
 * Rolls back on error
 */

import { useState, useTransition } from "react";
import { toast } from "sonner";

interface OptimisticUpdateOptions<T> {
  initialValue: T;
  updateFn: (value: T) => Promise<void>;
  onSuccess?: (value: T) => void;
  onError?: (error: Error, rollbackValue: T) => void;
  successMessage?: string;
  errorMessage?: string;
}

export function useOptimisticUpdate<T>({
  initialValue,
  updateFn,
  onSuccess,
  onError,
  successMessage,
  errorMessage,
}: OptimisticUpdateOptions<T>) {
  const [value, setValue] = useState<T>(initialValue);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<Error | null>(null);

  const update = async (newValue: T) => {
    const previousValue = value;
    
    // Optimistic update - update UI immediately
    setValue(newValue);
    setError(null);

    startTransition(async () => {
      try {
        await updateFn(newValue);
        
        if (onSuccess) {
          onSuccess(newValue);
        }
        
        if (successMessage) {
          toast.success(successMessage);
        }
      } catch (err) {
        // Rollback on error
        setValue(previousValue);
        const error = err instanceof Error ? err : new Error("Update failed");
        setError(error);
        
        if (onError) {
          onError(error, previousValue);
        }
        
        if (errorMessage) {
          toast.error(errorMessage);
        } else {
          toast.error(error.message || "Failed to update");
        }
      }
    });
  };

  return {
    value,
    update,
    isPending,
    error,
  };
}
