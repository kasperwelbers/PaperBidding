import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { customSession, emailOTP } from "better-auth/plugins";
import { Resend } from "resend";
import db, {
  authAccount,
  authSession,
  authUser,
  authVerification,
} from "@/drizzle/schema";
import { canCreateProject, isSuperAdmin } from "@/lib/permissions";

export const OTP_SENDER = "paperbidding@ica-cm.com";

async function sendVerificationOTP({
  email,
  otp,
}: {
  email: string;
  otp: string;
}) {
  if (!process.env.RESEND_API_KEY) {
    if (process.env.NODE_ENV === "development") {
      console.log(`\n[dev] Sign-in code for ${email}: ${otp}\n`);
      return;
    }
    throw new Error("RESEND_API_KEY is not set");
  }

  // Plain text only, with the code in the subject and no links,
  // so that university link scanners can't consume it and spam filters are less suspicious
  const resend = new Resend(process.env.RESEND_API_KEY);
  const response = await resend.emails.send({
    from: `ICA Paper Bidding <${OTP_SENDER}>`,
    to: [email],
    subject: `${otp} is your ICA Paper Bidding sign-in code`,
    text: `Your sign-in code for ICA Paper Bidding is:

${otp}

The code is valid for 10 minutes.
If you did not request this code, you can safely ignore this email.`,
  });
  if (response.error) throw new Error(JSON.stringify(response.error));
}

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: authUser,
      session: authSession,
      account: authAccount,
      verification: authVerification,
    },
  }),
  session: {
    expiresIn: 30 * 24 * 60 * 60,
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 5,
      storeOTP: "hashed",
      sendVerificationOTP,
    }),
    customSession(async ({ user, session }) => {
      return {
        session,
        user: {
          ...user,
          canCreateProject: await canCreateProject(user.email),
          isSuperAdmin: isSuperAdmin(user.email),
        },
      };
    }),
  ],
});
