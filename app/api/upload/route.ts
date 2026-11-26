import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { checkRateLimit, getClientIp } from '@/lib/ratelimit';

const MAX_BYTES = 512 * 1024; // 500KB sau khi nén WebP

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`upload:${ip}`, 20, 60);
  if (!rl.ok) {
    return NextResponse.json({ error: 'Upload quá nhanh, thử lại sau' }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Form upload không hợp lệ' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: 'Thiếu file ảnh' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Ảnh sau nén vượt quá 500KB' }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${randomUUID()}.webp`;

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.AUTH_MODE !== 'dev' && sbUrl && sbKey) {
    const sb = createClient(sbUrl, sbKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await sb.storage
      .from('place-photos')
      .upload(filename, buffer, { contentType: 'image/webp', upsert: false });
    if (error) {
      return NextResponse.json({ error: 'Không thể lưu ảnh lên Supabase' }, { status: 500 });
    }
    const { data } = sb.storage.from('place-photos').getPublicUrl(filename);
    return NextResponse.json({ url: data.publicUrl }, { status: 201 });
  }

  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), buffer);
  return NextResponse.json({ url: `/uploads/${filename}` }, { status: 201 });
}
