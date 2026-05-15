import { NextRequest, NextResponse } from 'next/server';

const MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export async function POST(request: NextRequest) {
  let body: { adminEmail?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { adminEmail } = body;
  if (!adminEmail || typeof adminEmail !== 'string' || !adminEmail.includes('@')) {
    return NextResponse.json({ error: 'Invalid admin email' }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('admin_session', adminEmail, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: MAX_AGE,
    path: '/',
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('admin_session');
  return response;
}
