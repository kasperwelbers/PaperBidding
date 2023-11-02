import { NextAuthOptions } from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import db from '@/drizzle/schema';
import { canCreateProject } from '@/lib/authenticate';
import EmailProvider from 'next-auth/providers/email';
import crypto from 'node:crypto';

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  adapter: DrizzleAdapter(db),

  providers: [
    EmailProvider({
      async sendVerificationRequest(params) {
        const { identifier, provider, token, theme } = params;
        const url = new URL(params.url);
        // url.searchParams.delete("token") // uncomment if you want the user to type this manually
        const signInURL = new URL(`/auth/email?${url.searchParams}`, url.origin);
        const escapedHost = signInURL.host.replace(/\./g, '&#8203;.');

        const email = {
          to: identifier,
          from: { email: 'cm@middlecat.net', name: 'ICA Computational Methods' },
          subject: `Sign in to CM Paper Bidding`,
          text: `Sign in on CM Paper Bidding using the verification code: ${token}`,
          html: `<body style="background: #f9f9f9;"><table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: #fff; max-width: 600px; margin: auto; border-radius: 10px;"> <tr> <td align="center" style="padding: 10px 0px; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: #444;"> Sign in to <strong>${escapedHost}</strong></td></tr><tr> <td align="center" style="padding: 20px 0;"> <table border="0" cellspacing="0" cellpadding="0"> <tr> <td align="center" style="border-radius: 5px;" bgcolor="${theme.brandColor}"><a href="${signInURL}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${theme.buttonText}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${theme.brandColor}; display: inline-block; font-weight: bold;">Sign in</a></td></tr></table> </td></tr><tr> <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: #444;"> If you did not request this email you can safely ignore it. </td></tr></table></body>`
        };

        const response = await fetch(process.env.MIDDLECAT_MAIL || '', {
          body: JSON.stringify(email),
          headers: {
            Authorization: `${process.env.MIDDLECAT_MAIL_TOKEN}`,
            'Content-Type': 'application/json'
          },
          method: 'POST'
        });

        if (!response.ok) {
          const { errors } = await response.json();
          throw new Error(JSON.stringify(errors));
        }
      }
    })
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.canCreateProject = await canCreateProject(session?.user.email || '');
      return session;
    }
  }
};
