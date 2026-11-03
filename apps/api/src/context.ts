import { Hono, type Context } from "hono";
import type { Db } from "@cp/db";
import type { Auth } from "./auth";
import type { ConferenceRole } from "./permissions";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    db: Db;
    auth: Auth;
    /** signed in user (normalized), or null */
    email: string | null;
    /** set by loadConference, for routes under /conferences/:conferenceId */
    conferenceId: number;
    role: ConferenceRole | null;
  };
};

export const router = () => new Hono<AppEnv>();

/** The signed in user's email. Only use after requireUser */
export function userEmail(c: Context<AppEnv>) {
  const email = c.get("email");
  if (!email) throw new Error("requireUser middleware missing");
  return email;
}

export function isUniqueViolation(e: unknown) {
  const msg = e instanceof Error ? `${e.message} ${String(e.cause ?? "")}` : String(e);
  return msg.includes("UNIQUE constraint failed");
}
