import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { authAccount, authSession, authUser, authVerification, type Db } from "@cp/db";
import { getEmailSender } from "./email";

/** better-auth, created per request because the bindings come with the
 *  request. The app's address: BETTER_AUTH_URL, or else the request's origin */
export function createAuth(env: Env, db: Db, origin: string) {
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL || origin,
    basePath: "/api/auth",
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: authUser,
        session: authSession,
        account: authAccount,
        verification: authVerification,
      },
    }),
    session: { expiresIn: 30 * 24 * 60 * 60 },
    plugins: [
      emailOTP({
        otpLength: 6,
        expiresIn: 600,
        allowedAttempts: 5,
        storeOTP: "hashed",
        // Plain text, code in the subject, no links: university link scanners
        // can't consume it, and spam filters are less suspicious
        async sendVerificationOTP({ email, otp }) {
          // only here: without email set up, everything else keeps working
          await getEmailSender(env).send({
            to: email,
            subject: `${otp} is your Conference planner sign-in code`,
            text: `Your sign-in code is:\n\n${otp}\n\nThe code is valid for 10 minutes.\nIf you did not request this code, you can safely ignore this email.`,
          });
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
