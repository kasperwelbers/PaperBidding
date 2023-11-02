import NextAuth from 'next-auth';
import { authOptions } from '@/auth/authOptions';
import { NextResponse } from 'next/server';

const handler = NextAuth(authOptions);

export async function GET(...args: any[]) {
  const req = args[0];
  if (req.method === 'HEAD') {
    // intercept HEAD requests to prevent safelink checks from invalidating email sign-in links
    // https://next-auth.js.org/tutorials/avoid-corporate-link-checking-email-provider#disable-safelink
    return NextResponse.json({}, { status: 200 });
  }

  return handler(...args);
}

export async function POST(...args: any[]) {
  return handler(...args);
}
