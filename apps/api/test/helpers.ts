import { env } from "cloudflare:workers";
import { app } from "../src/app";
import { sentTestEmails } from "../src/email";

/** Signs in with an email code, like a user would. Returns a fetch helper
 *  that sends the session cookie */
export async function signIn(email: string) {
  const headers = { "Content-Type": "application/json", Origin: "http://localhost" };
  const sent = await app.request(
    "/api/auth/email-otp/send-verification-otp",
    { method: "POST", headers, body: JSON.stringify({ email, type: "sign-in" }) },
    env,
  );
  if (!sent.ok) throw new Error(`send otp failed: ${sent.status} ${await sent.text()}`);
  const mail = [...sentTestEmails].reverse().find((m) => m.to === email);
  const otp = mail?.subject.match(/^(\d{6})/)?.[1];
  if (!otp) throw new Error("no sign-in code sent");

  const res = await app.request(
    "/api/auth/sign-in/email-otp",
    { method: "POST", headers, body: JSON.stringify({ email, otp }) },
    env,
  );
  if (!res.ok) throw new Error(`sign in failed: ${res.status} ${await res.text()}`);
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

  return (path: string, init: { method?: string; body?: unknown } = {}) =>
    app.request(
      path,
      {
        method: init.method ?? "GET",
        headers: { ...headers, Cookie: cookie },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      },
      env,
    );
}
