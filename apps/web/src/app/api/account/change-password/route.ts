import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

import { getSupabaseServerSessionClient } from '@/lib/supabase/server-session';
import { env } from '@/lib/env/server';

export async function POST(request: Request) {
  try {
    const supabase = await getSupabaseServerSessionClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
    }

    const body = (await request.json()) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!body.currentPassword || !body.newPassword) {
      return NextResponse.json(
        { error: 'Current password and new password are required.' },
        { status: 400 },
      );
    }

    if (body.newPassword.length < 12) {
      return NextResponse.json(
        { error: 'New password must be at least 12 characters.' },
        { status: 400 },
      );
    }

    // Verify the current password by attempting to sign in
    const verifyClient = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );

    const { error: signInError } = await verifyClient.auth.signInWithPassword({
      email: user.email ?? '',
      password: body.currentPassword,
    });

    if (signInError) {
      return NextResponse.json(
        { error: 'Current password is incorrect.' },
        { status: 400 },
      );
    }

    // Update the password using admin client
    const adminClient = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const { error: updateError } = await adminClient.auth.admin.updateUserById(
      user.id,
      { password: body.newPassword },
    );

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message || 'Failed to update password.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }
}
