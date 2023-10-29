import { NextResponse } from 'next/server';
import db, { projects, projectAdmins } from '@/drizzle/schema';
import { authenticate, isSuperAdmin } from '@/lib/authenticate';
import { eq } from 'drizzle-orm';
import cryptoRandomString from 'crypto-random-string';

export async function POST(req: Request) {
  const { email, canCreateProject } = await authenticate();
  if (!email) return NextResponse.json({}, { statusText: 'Not signed in', status: 403 });
  if (!canCreateProject) return NextResponse.json({}, { status: 403 });

  const { to, html } = await req.json();

  const message = {
    from: 'ICA-Computational-Methods@middlecat.net',
    to,
    subject: 'Paper bidding invitation',
    html
  };

  const response = await fetch(process.env.MIDDLECAT_MAIL || '', {
    body: JSON.stringify(message),
    headers: {
      Authorization: `${process.env.MIDDLECAT_MAIL_TOKEN}`,
      'Content-Type': 'application/json'
    },
    method: 'POST'
  });

  if (response.ok) {
    return NextResponse.json({}, { status: 201 });
  } else {
    return NextResponse.json({}, { status: 400 });
  }
}
