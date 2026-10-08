import { createAuthClient } from "better-auth/react";
import {
  customSessionClient,
  emailOTPClient,
} from "better-auth/client/plugins";
import type { auth } from "./auth";
import { useRef } from "react";

export const authClient = createAuthClient({
  plugins: [emailOTPClient(), customSessionClient<typeof auth>()],
});

export const { signOut } = authClient;

type SessionStatus = "loading" | "authenticated" | "unauthenticated";

/** better-auth useSession, with a next-auth style status field.
 *  better-auth refetches the session when the window regains focus, and while
 *  signed out it then sets isPending to true again. We only report "loading" for
 *  the initial fetch, so that components (like the sign-in code form) don't
 *  unmount when the user switches back from their mail tab */
export function useSession() {
  const session = authClient.useSession();
  const lastStatus = useRef<SessionStatus | null>(null);

  let status: SessionStatus;
  if (session.isPending) {
    status = lastStatus.current ?? "loading";
  } else {
    status = session.data ? "authenticated" : "unauthenticated";
    lastStatus.current = status;
  }
  return { ...session, status };
}
