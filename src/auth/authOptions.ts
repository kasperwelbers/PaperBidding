import { NextAuthOptions } from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import db from "@/drizzle/schema";
import { canCreateProject } from "@/lib/authenticate";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,

  adapter: DrizzleAdapter(db),
  providers: [
    {
      id: "email",
      type: "email",
      from: "ignored",
      server: {},
      maxAge: 24 * 60 * 60,
      name: "Email",
      options: {},
      async sendVerificationRequest(params) {
        const { identifier, token, theme } = params;
        const url = new URL(params.url);
        // url.searchParams.delete("token") // uncomment if you want the user to type this manually
        const signInURL = new URL(
          `/auth/email?${url.searchParams}`,
          url.origin,
        );
        const escapedHost = signInURL.host.replace(/\./g, "&#8203;.");

        const email = {
          from: "ICA Paper Bidding <paperbidding@ica-cm.com>",
          to: [identifier],
          subject: `Sign in to ICA Paper Bidding`,
          text: `Sign in on ICA Paper Bidding using the verification code: ${token}`,
          html: `<body style="background: #f9f9f9;"><table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: #fff; max-width: 600px; margin: auto; border-radius: 10px;"> <tr> <td align="center" style="padding: 10px 0px; font-size: 22px; font-family: Helvetica, Arial, sans-serif; color: #444;"> Hi! Click here to sign-in to the paper bidding website</strong></td></tr><tr> <td align="center" style="padding: 20px 0;"> <table border="0" cellspacing="0" cellpadding="0"> <tr> <td align="center" style="border-radius: 5px;" bgcolor="${theme.brandColor}"><a href="${signInURL}" target="_blank" style="font-size: 26px; font-family: Helvetica, Arial, sans-serif; color: ${theme.buttonText}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${theme.brandColor}; display: inline-block; font-weight: bold;">Sign in</a></td></tr></table> </td></tr><tr> <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: #444;"> If you did not request this email you can safely ignore it. </td></tr></table></body>`,
        };

        const response = await resend.emails.send(email);
        if (response.error) {
          throw new Error(JSON.stringify(response.error));
        }
      },
    },
  ],
  callbacks: {
    async session({ session, user }) {
      session.user.canCreateProject = await canCreateProject(
        session?.user.email || "",
      );
      return session;
    },
  },
};
