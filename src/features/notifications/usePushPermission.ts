/**
 * The current notification permission, re-read when the app comes back to the foreground (the
 * seller may have just changed it in system settings).
 */
import { useCallback, useEffect, useState } from 'react';
import { getPushPermission, type PushPermission } from '@/core/push/permission';
import { useAppActive } from '@/core/useAppActive';

export function usePushPermission(): {
  permission: PushPermission | null;
  refresh: () => void;
} {
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const active = useAppActive();
  const refresh = useCallback(() => {
    getPushPermission()
      .then(setPermission)
      .catch(() => setPermission('undetermined'));
  }, []);
  useEffect(() => {
    if (active) refresh();
  }, [active, refresh]);
  return { permission, refresh };
}
