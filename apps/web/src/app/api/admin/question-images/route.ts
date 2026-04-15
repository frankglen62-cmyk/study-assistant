import { NextResponse } from 'next/server';
import { requirePortalUser } from '@/lib/auth/request-context';
import { getSupabaseAdmin } from '@/lib/supabase/server';
import { getRequestMeta, jsonError } from '@/lib/http/route';

const BUCKET = 'question-images';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const { requestId } = getRequestMeta(request);

  try {
    await requirePortalUser(request, ['admin', 'super_admin']);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only PNG, JPEG, WebP, and GIF are allowed.' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File too large. Maximum size is 5MB.' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
    const storagePath = `${crypto.randomUUID()}.${ext}`;

    const buffer = Buffer.from(await file.arrayBuffer());
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      console.error('Question image upload failed:', uploadError);
      return NextResponse.json({ error: 'Upload failed: ' + uploadError.message }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);

    return NextResponse.json({
      url: publicUrl,
      storagePath,
      fileName: file.name,
    });
  } catch (error) {
    return jsonError(error, requestId);
  }
}
