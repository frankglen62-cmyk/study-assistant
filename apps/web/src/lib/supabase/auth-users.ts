import 'server-only';

import { getSupabaseAdmin } from '@/lib/supabase/server';

type AuthUserMatch = {
  id: string;
  email: string | null;
  newEmail: string | undefined;
};

export async function findAuthUserByEmail(candidateEmail: string): Promise<AuthUserMatch | null> {
  const admin = getSupabaseAdmin();
  const normalizedEmail = candidateEmail.trim().toLowerCase();

  let page = 1;

  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 500,
    });

    if (error) {
      throw error;
    }

    const matchedUser = data.users.find((user) => {
      const primaryEmail = user.email?.trim().toLowerCase();
      const pendingEmail = user.new_email?.trim().toLowerCase();

      return primaryEmail === normalizedEmail || pendingEmail === normalizedEmail;
    });

    if (matchedUser) {
      return {
        id: matchedUser.id,
        email: matchedUser.email ?? null,
        newEmail: matchedUser.new_email,
      };
    }

    if (data.users.length < 500) {
      break;
    }

    page += 1;
  }

  return null;
}
