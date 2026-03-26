const encoder = new TextEncoder();
const decoder = new TextDecoder();

const LOGIN_REQUEST_TTL_SECONDS = 15 * 60;
const LOGIN_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
const EMAIL_CHANGE_REQUEST_TTL_SECONDS = 30 * 60;

export const EMAIL_LOGIN_REQUEST_COOKIE = 'sa_email_login_request';
export const EMAIL_LOGIN_SESSION_COOKIE = 'sa_email_login_session';
export const EMAIL_CHANGE_REQUEST_COOKIE = 'sa_email_change_request';

type TokenKind = 'email_login_request' | 'email_login_session' | 'email_change_request';

type BasePayload = {
  kind: TokenKind;
  exp: number;
};

type EmailLoginRequestPayload = BasePayload & {
  kind: 'email_login_request';
  userId: string;
  email: string;
  nextPath: string;
};

type EmailLoginSessionPayload = BasePayload & {
  kind: 'email_login_session';
  userId: string;
  signInAt: string;
};

type EmailChangeRequestPayload = BasePayload & {
  kind: 'email_change_request';
  userId: string;
  currentEmail: string;
  targetEmail: string;
  nextPath: string;
};

function getSigningSecret() {
  const secret = process.env.AUTH_EMAIL_CHALLENGE_SECRET ?? process.env.EXTENSION_PAIRING_SECRET;

  if (!secret) {
    throw new Error('AUTH_EMAIL_CHALLENGE_SECRET or EXTENSION_PAIRING_SECRET is required.');
  }

  return secret;
}

function toBase64(value: Uint8Array) {
  let binary = '';

  value.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}

function toBase64Url(value: Uint8Array) {
  return toBase64(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  const binary = atob(`${normalized}${padding}`);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

async function getSigningKey() {
  return crypto.subtle.importKey('raw', encoder.encode(getSigningSecret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function createToken<T extends BasePayload>(payload: T) {
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await getSigningKey();
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));

  return `${body}.${toBase64Url(new Uint8Array(signature))}`;
}

async function verifyToken<T extends BasePayload>(token: string, expectedKind: T['kind']) {
  const [body, signature] = token.split('.');

  if (!body || !signature) {
    return null;
  }

  const key = await getSigningKey();
  const isValid = await crypto.subtle.verify('HMAC', key, fromBase64Url(signature), encoder.encode(body));

  if (!isValid) {
    return null;
  }

  try {
    const payload = JSON.parse(decoder.decode(fromBase64Url(body))) as T;

    if (payload.kind !== expectedKind || payload.exp < Date.now()) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function getSafeNextPath(candidate: string | null | undefined, fallback = '/dashboard') {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback;
  }

  return candidate;
}

export function buildEmailChallengeCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function buildExpiredEmailChallengeCookieOptions() {
  return {
    ...buildEmailChallengeCookieOptions(0),
    maxAge: 0,
  };
}

export async function createSignedEmailLoginRequestToken(input: {
  userId: string;
  email: string;
  nextPath: string;
}) {
  return createToken<EmailLoginRequestPayload>({
    kind: 'email_login_request',
    userId: input.userId,
    email: input.email,
    nextPath: input.nextPath,
    exp: Date.now() + LOGIN_REQUEST_TTL_SECONDS * 1000,
  });
}

export async function verifySignedEmailLoginRequestToken(token: string) {
  return verifyToken<EmailLoginRequestPayload>(token, 'email_login_request');
}

export async function createSignedEmailLoginSessionToken(input: {
  userId: string;
  signInAt: string;
}) {
  return createToken<EmailLoginSessionPayload>({
    kind: 'email_login_session',
    userId: input.userId,
    signInAt: input.signInAt,
    exp: Date.now() + LOGIN_SESSION_TTL_SECONDS * 1000,
  });
}

export async function verifySignedEmailLoginSessionToken(token: string) {
  return verifyToken<EmailLoginSessionPayload>(token, 'email_login_session');
}

export async function createSignedEmailChangeRequestToken(input: {
  userId: string;
  currentEmail: string;
  targetEmail: string;
  nextPath: string;
}) {
  return createToken<EmailChangeRequestPayload>({
    kind: 'email_change_request',
    userId: input.userId,
    currentEmail: input.currentEmail,
    targetEmail: input.targetEmail,
    nextPath: input.nextPath,
    exp: Date.now() + EMAIL_CHANGE_REQUEST_TTL_SECONDS * 1000,
  });
}

export async function verifySignedEmailChangeRequestToken(token: string) {
  return verifyToken<EmailChangeRequestPayload>(token, 'email_change_request');
}
