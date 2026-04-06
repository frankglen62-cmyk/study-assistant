import type { ExtensionSessionStateStatus, ExtensionUiStatus } from '@study-assistant/shared-types';

const uiStatusLabels: Record<ExtensionUiStatus, string> = {
  ready: 'Ready',
  not_connected: 'Not connected',
  maintenance: 'Maintenance',
  no_credits: 'No credits',
  scanning_page: 'Scanning page',
  detecting_subject: 'Detecting subject',
  searching_sources: 'Searching sources',
  suggestion_ready: 'Suggestion ready',
  low_confidence: 'Low confidence',
  no_match_found: 'No match found',
  error: 'Error',
};

const uiStatusClassNames: Record<ExtensionUiStatus, string> = {
  ready: 'status-pill status-pill--success',
  not_connected: 'status-pill status-pill--muted',
  maintenance: 'status-pill status-pill--warning',
  no_credits: 'status-pill status-pill--danger',
  scanning_page: 'status-pill status-pill--warning',
  detecting_subject: 'status-pill status-pill--warning',
  searching_sources: 'status-pill status-pill--warning',
  suggestion_ready: 'status-pill status-pill--success',
  low_confidence: 'status-pill status-pill--warning',
  no_match_found: 'status-pill status-pill--muted',
  error: 'status-pill status-pill--danger',
};

const sessionLabels: Record<ExtensionSessionStateStatus, string> = {
  session_inactive: 'Session inactive',
  session_active: 'Session active',
  session_paused: 'Session paused',
  session_expired: 'Session expired',
};

export function UiStatusPill({ status }: { status: ExtensionUiStatus }) {
  return <span className={uiStatusClassNames[status]}>{uiStatusLabels[status]}</span>;
}

export function SessionStatusPill({ status }: { status: ExtensionSessionStateStatus }) {
  const className =
    status === 'session_active'
      ? 'status-pill status-pill--success'
      : status === 'session_paused'
        ? 'status-pill status-pill--warning'
        : 'status-pill status-pill--muted';

  return <span className={className}>{sessionLabels[status]}</span>;
}
