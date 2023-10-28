import { NextAuthOptions } from 'next-auth';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import db from '@/drizzle/schema';

export const authOptions: NextAuthOptions = {
  //secret: process.env.NEXTAUTH_SECRET,

  adapter: DrizzleAdapter(db),
  providers: [
    {
      id: 'email',
      type: 'email',
      from: 'ICA-Computational-Methods@middlecat.net',
      server: {},
      maxAge: 24 * 60 * 60,
      name: 'Email',
      options: {},
      async sendVerificationRequest(params) {
        const { identifier, url, provider } = params;

        const email = {
          from: provider.from,
          to: identifier,
          subject: 'Sign in to CM Paperbidding',
          text: `Please click here to authenticate - ${url}`
        };

        console.log(email);

        const response = await fetch(process.env.MIDDLECAT_MAIL, {
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
    }
  ]
};
