import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { env } from '@/lib/env/server';

function withSafeSessionCookieDefaults(options: Record<string, unknown> | undefined) {
  const secure = typeof options?.secure === 'boolean' ? options.secure : process.env.NODE_ENV === 'production';

  return {
    path: '/',
    sameSite: 'lax' as const,
    ...options,
    secure,
  };
}

export async function getSupabaseServerSessionClient() {
  const cookieStore = await cookies();

  return createServerClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookieOptions: withSafeSessionCookieDefaults(undefined),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
        for (const cookie of cookiesToSet) {
          try {
            cookieStore.set(cookie.name, cookie.value, withSafeSessionCookieDefaults(cookie.options));
          } catch {
            // Route handlers can ignore write attempts during read-only auth checks.
          }
        }
      },
    },
  });
}
