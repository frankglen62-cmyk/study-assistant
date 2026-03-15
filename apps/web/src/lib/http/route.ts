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
  return {
    requestId: request.headers.get('x-request-id') ?? randomUUID(),
    ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
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

export async function parseJsonBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const rawText = await request.text();
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
