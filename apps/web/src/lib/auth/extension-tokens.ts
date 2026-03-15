import { env } from '@/lib/env/server';
import { RouteError } from '@/lib/http/route';
import { hmacSha256Base64Url, randomToken, safeEqual, sha256Hex } from '@/lib/security/hash';

export interface ExtensionAccessTokenPayload {
  installationId: string;
  userId: string;
  type: 'extension_access';
  exp: number;
}

function encodePayload(payload: ExtensionAccessTokenPayload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

function decodePayload(token: string): ExtensionAccessTokenPayload {
  try {
    const parsed = JSON.parse(Buffer.from(token, 'base64url').toString('utf8')) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'installationId' in parsed &&
      'userId' in parsed &&
      'type' in parsed &&
      'exp' in parsed &&
      typeof parsed.installationId === 'string' &&
      typeof parsed.userId === 'string' &&
      parsed.type === 'extension_access' &&
      typeof parsed.exp === 'number'
    ) {
      return parsed as unknown as ExtensionAccessTokenPayload;
    }
  } catch {
    // fall through
  }

  throw new RouteError(401, 'invalid_extension_token', 'Extension token is invalid.');
}

export function createExtensionAccessToken(input: {
  installationId: string;
  userId: string;
  ttlSeconds?: number;
}) {
  const payload: ExtensionAccessTokenPayload = {
    installationId: input.installationId,
    userId: input.userId,
    type: 'extension_access',
    exp: Math.floor(Date.now() / 1000) + (input.ttlSeconds ?? env.EXTENSION_ACCESS_TOKEN_TTL_SECONDS),
  };

  const encodedPayload = encodePayload(payload);
  const signature = hmacSha256Base64Url(env.EXTENSION_PAIRING_SECRET, encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyExtensionAccessToken(token: string) {
  const [payloadPart, signaturePart] = token.split('.');

  if (!payloadPart || !signaturePart) {
    throw new RouteError(401, 'invalid_extension_token', 'Extension token is invalid.');
  }

  const expectedSignature = hmacSha256Base64Url(env.EXTENSION_PAIRING_SECRET, payloadPart);
  if (!safeEqual(expectedSignature, signaturePart)) {
    throw new RouteError(401, 'invalid_extension_token', 'Extension token signature is invalid.');
  }

  const payload = decodePayload(payloadPart);
  if (payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new RouteError(401, 'extension_token_expired', 'Extension token has expired.');
  }

  return payload;
}

export function issueRefreshToken() {
  const token = randomToken(48);
  return {
    token,
    tokenHash: sha256Hex(token),
    expiresAt: new Date(Date.now() + env.EXTENSION_REFRESH_TOKEN_TTL_SECONDS * 1000).toISOString(),
  };
}

export function hashOpaqueToken(value: string) {
  return sha256Hex(value);
}

export function issuePairingCode(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const entropy = randomToken(length);
  let code = '';

  for (let index = 0; index < length; index += 1) {
    const char = entropy[index % entropy.length] ?? 'A';
    code += alphabet[char.charCodeAt(0) % alphabet.length];
  }

  return code;
}
