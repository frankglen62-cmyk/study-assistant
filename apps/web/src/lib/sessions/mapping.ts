import type { ExtensionSessionStateStatus } from '@study-assistant/shared-types';

import type { SessionRecord } from '@/lib/supabase/schemas';

export function toExtensionSessionStatus(status: SessionRecord['status']): ExtensionSessionStateStatus {
  switch (status) {
    case 'active':
      return 'session_active';
    case 'paused':
      return 'session_paused';
    case 'ended':
    case 'timed_out':
    case 'no_credit':
    case 'no_match':
    case 'failed':
      return 'session_inactive';
    default:
      return 'session_inactive';
  }
}
