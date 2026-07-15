import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { parseJsonBody, readRequestText } from '@/lib/http/route';

describe('bounded request body reader', () => {
  it('rejects an oversized content-length before reading the stream', async () => {
    const request = new Request('https://app.example.com/api/test', {
      method: 'POST',
      headers: { 'content-length': '5000' },
      body: 'small',
    });

    await expect(readRequestText(request, { maxBytes: 100 })).rejects.toMatchObject({
      status: 413,
      code: 'request_too_large',
    });
  });

  it('stops a chunked body as soon as its byte budget is exceeded', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('12345'));
        controller.enqueue(encoder.encode('67890'));
        controller.close();
      },
    });
    const request = new Request('https://app.example.com/api/test', {
      method: 'POST',
      body: stream,
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });

    await expect(readRequestText(request, { maxBytes: 8 })).rejects.toMatchObject({
      status: 413,
      code: 'request_too_large',
    });
  });

  it('parses a JSON body that stays within the configured byte limit', async () => {
    const request = new Request('https://app.example.com/api/test', {
      method: 'POST',
      body: JSON.stringify({ value: 'safe' }),
    });

    await expect(
      parseJsonBody(request, z.object({ value: z.literal('safe') }), { maxBytes: 100 }),
    ).resolves.toEqual({ value: 'safe' });
  });
});
