import { randomUUID } from 'node:crypto';

import { NextResponse } from 'next/server';
import type { ZodType } from 'zod';

export class RouteError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getRequestMeta(request: Request) {
  const forwardedIp =
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    null;
  const suppliedRequestId = request.headers.get('x-request-id');

  return {
    requestId: suppliedRequestId && suppliedRequestId.length <= 128 ? suppliedRequestId : randomUUID(),
    ipAddress: forwardedIp && forwardedIp.length <= 64 ? forwardedIp : null,
    userAgent: request.headers.get('user-agent') ?? null,
  };
}

export function jsonOk<T>(data: T, requestId: string, init?: ResponseInit) {
  const response = NextResponse.json(data, init);
  response.headers.set('x-request-id', requestId);
  return response;
}

export function jsonError(error: unknown, requestId: string) {
  if (error instanceof RouteError) {
    const response = NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details ?? null,
      },
      { status: error.status },
    );
    response.headers.set('x-request-id', requestId);
    return response;
  }

  const response = NextResponse.json(
    {
      error: 'Internal server error.',
      code: 'internal_error',
    },
    { status: 500 },
  );
  response.headers.set('x-request-id', requestId);
  return response;
}

export async function readRequestText(request: Request, options: { maxBytes?: number } = {}) {
  const maxBytes = options.maxBytes ?? 1024 * 1024;
  const contentLength = Number(request.headers.get('content-length'));

  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw new RouteError(413, 'request_too_large', `Request body exceeds the ${maxBytes}-byte limit.`);
  }

  if (!request.body) {
    return '';
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  const parts: string[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel('request body exceeded configured limit').catch(() => undefined);
        throw new RouteError(413, 'request_too_large', `Request body exceeds the ${maxBytes}-byte limit.`);
      }

      parts.push(decoder.decode(value, { stream: true }));
    }

    parts.push(decoder.decode());
    return parts.join('');
  } finally {
    reader.releaseLock();
  }
}

export async function parseJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
  options: { maxBytes?: number } = {},
): Promise<T> {
  const maxBytes = options.maxBytes ?? 1024 * 1024;
  const rawText = await readRequestText(request, { maxBytes });

  let json: unknown;

  try {
    json = rawText ? (JSON.parse(rawText) as unknown) : undefined;
  } catch (error) {
    throw new RouteError(400, 'invalid_json', 'Request body must be valid JSON.', error);
  }

  const result = schema.safeParse(json);

  if (!result.success) {
    throw new RouteError(400, 'invalid_request', 'Request body validation failed.', result.error.flatten());
  }

  return result.data;
}

export function getBearerToken(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new RouteError(401, 'missing_bearer_token', 'Authorization token is required.');
  }

  return authorization.slice('Bearer '.length).trim();
}
