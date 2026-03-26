import 'server-only';

import { redirect } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import type { UserRole } from '@study-assistant/shared-types';

import { getSupabaseServerSessionClient } from '@/lib/supabase/server-session';
import { getProfileWithWalletByUserId } from '@/lib/supabase/users';

export async function requirePageUser(allowedRoles: UserRole[] = ['client']) {
  const supabase = await getSupabaseServerSessionClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect('/login');
  }

  const context = await getProfileWithWalletByUserId(data.user.id);

  if (!allowedRoles.includes(context.profile.role)) {
    redirect(context.profile.role === 'client' ? '/dashboard' : '/admin/dashboard');
  }

  if (context.profile.account_status !== 'active') {
    redirect('/login');
  }

  const authEmailTwoFactorValue = data.user.user_metadata?.email_2fa_enabled;
  const emailTwoFactorEnabled =
    typeof authEmailTwoFactorValue === 'boolean'
      ? authEmailTwoFactorValue
      : context.profile.email_2fa_enabled === true;

  return {
    userId: data.user.id,
    authUser: data.user as User,
    authEmail: data.user.email ?? context.profile.email,
    emailTwoFactorEnabled,
    profile: context.profile,
    wallet: context.wallet,
  };
}
