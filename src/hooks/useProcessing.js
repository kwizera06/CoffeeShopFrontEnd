// src/hooks/useProcessing.js
import { useState, useCallback } from 'react';

/**
 * Hook to manage processing state for async actions.
 * Returns a boolean `isProcessing` and a `wrapAsync` helper that
 * automatically toggles the state before/after the provided async fn.
 */
export default function useProcessing() {
  const [isProcessing, setProcessing] = useState(false);

  const wrapAsync = useCallback(
    async (asyncFn) => {
      if (isProcessing) return; // prevent double calls
      setProcessing(true);
      try {
        await asyncFn();
      } finally {
        setProcessing(false);
      }
    },
    [isProcessing]
  );

  return { isProcessing, wrapAsync };
}
