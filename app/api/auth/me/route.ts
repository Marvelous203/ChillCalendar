import { NextResponse } from 'next/server';
import { getAuthUser, isDevAuthMode } from '@/lib/auth';

export async function GET() {
  const user = await getAuthUser();
  return NextResponse.json({
    user,
    authMode: isDevAuthMode() ? 'dev' : 'supabase',
  });
}
