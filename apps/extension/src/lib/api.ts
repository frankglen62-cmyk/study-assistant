import type { ExtensionPageSignals, ExtensionState } from '@study-assistant/shared-types';
import { normalizeAppUrl } from '@study-assistant/shared-utils';

import {
  analyzeResponseSchema,
  catalogResponseSchema,
  deviceRevokeResponseSchema,
  pairingExchangeResponseSchema,
  refreshTokenResponseSchema,
  sessionResponseSchema,
  walletResponseSchema,
} from './validators';

const ANALYZE_REQUEST_TIMEOUT_MS = 15_000;

interface FetchOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export class ApiError extends Error {
  status: number;
  code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function createRequestSignal(signal: AbortSignal | undefined, timeoutMs: number): AbortSignal | undefined {
  if (typeof AbortController === 'undefined') {
    return signal;
  }

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const abort = (reason?: unknown) => {
    if (!controller.signal.aborted) {
      controller.abort(reason);
    }
  };

  const onSourceAbort = () => {
    abort(signal?.reason);
  };

  if (signal) {
    if (signal.aborted) {
      abort(signal.reason);
    } else {
      signal.addEventListener('abort', onSourceAbort, { once: true });
    }
  }

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => {
      abort(new DOMException('The request timed out.', 'TimeoutError'));
    }, timeoutMs);
  }

  controller.signal.addEventListener(
    'abort',
    () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (signal) {
        signal.removeEventListener('abort', onSourceAbort);
      }
    },
    { once: true },
  );

  return controller.signal;
}

async function fetchJson<T>(
  state: ExtensionState,
  path: string,
  parse: (input: unknown) => T,
  options: FetchOptions = {},
): Promise<T> {
  if (!state.appBaseUrl) {
    throw new Error('App URL is not configured yet.');
  }

  const mergedSignal = createRequestSignal(options.signal, options.timeoutMs ?? 10000);

  const init: RequestInit = {
    method: options.method ?? 'GET',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      ...(state.accessToken ? { Authorization: `Bearer ${state.accessToken}` } : {}),
      'X-Extension-Version': state.extensionVersion || 'unknown',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
    signal: mergedSignal,
  };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  let response: Response;

  try {
    response = await fetch(`${normalizeAppUrl(state.appBaseUrl)}${path}`, init);
  } catch (error) {
    if ((error as Error).name === 'TimeoutError' || (error as Error).name === 'AbortError') {
      throw new ApiError(
        408,
        'The analysis request timed out. The server took too long to respond.',
        'timeout_error',
      );
    }
    throw new ApiError(
      0,
      `Could not reach ${normalizeAppUrl(
        state.appBaseUrl,
      )}. Allow the app connection permission and make sure the web app is running on that exact URL.`,
      'network_error',
    );
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}.`;
    let code: string | null = null;

    const rawError = await response.text();
    if (rawError) {
      try {
        const payload = JSON.parse(rawError) as { error?: string; code?: string };
        message = payload.error ?? message;
        code = payload.code ?? null;
      } catch {
        message = rawError;
      }
    }

    throw new ApiError(response.status, message, code);
  }

  const json = (await response.json()) as unknown;
  return parse(json);
}

export async function exchangePairingCode(
  state: ExtensionState,
  payload: {
    pairingCode: string;
    deviceName: string;
    browserName: string;
    extensionVersion: string;
  },
) {
  return fetchJson(state, '/api/auth/extension/exchange', (input) => pairingExchangeResponseSchema.parse(input), {
    method: 'POST',
    body: payload,
  });
}

export async function refreshWallet(state: ExtensionState) {
  return fetchJson(state, '/api/client/wallet', (input) => walletResponseSchema.parse(input));
}

export async function refreshExtensionToken(state: ExtensionState) {
  return fetchJson(state, '/api/auth/extension/refresh', (input) => refreshTokenResponseSchema.parse(input), {
    method: 'POST',
    body: {
      refreshToken: state.refreshToken,
      installationId: state.installationId,
    },
  });
}

export async function startSession(state: ExtensionState) {
  return fetchJson(state, '/api/client/sessions/start', (input) => sessionResponseSchema.parse(input), {
    method: 'POST',
  });
}

export async function pauseSession(state: ExtensionState) {
  return fetchJson(state, '/api/client/sessions/pause', (input) => sessionResponseSchema.parse(input), {
    method: 'POST',
  });
}

export async function resumeSession(state: ExtensionState) {
  return fetchJson(state, '/api/client/sessions/resume', (input) => sessionResponseSchema.parse(input), {
    method: 'POST',
  });
}

export async function endSession(state: ExtensionState) {
  return fetchJson(state, '/api/client/sessions/end', (input) => sessionResponseSchema.parse(input), {
    method: 'POST',
  });
}

export async function revokeCurrentInstallation(state: ExtensionState) {
  if (!state.installationId) {
    throw new Error('This browser is not paired yet.');
  }

  return fetchJson(state, '/api/client/devices/revoke', (input) => deviceRevokeResponseSchema.parse(input), {
    method: 'POST',
    body: {
      installationId: state.installationId,
    },
  });
}

export async function analyzePage(
  state: ExtensionState,
  payload: {
    mode: 'analyze' | 'detect' | 'suggest';
    pageSignals: ExtensionPageSignals;
    screenshotDataUrl: string | null;
    manualSubject: string;
    manualCategory: string;
    searchScope: 'subject_first' | 'all_subjects';
    sessionId: string | null;
    liveAssist: boolean;
    forceRedetect?: boolean;
    signal?: AbortSignal;
  },
) {
  return fetchJson(state, '/api/client/analyze', (input) => analyzeResponseSchema.parse(input), {
    method: 'POST',
    body: payload,
    signal: payload.signal,
    timeoutMs: ANALYZE_REQUEST_TIMEOUT_MS,
  });
}

export async function fetchSubjects(state: ExtensionState) {
  return fetchJson(state, '/api/client/subjects', (input) => catalogResponseSchema.parse(input));
}
