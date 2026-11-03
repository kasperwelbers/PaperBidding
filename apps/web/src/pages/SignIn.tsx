import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../api";
import { authClient } from "../auth";
import { Button, ErrorText, Input } from "../ui";

export default function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const health = useQuery({ queryKey: ["health"], queryFn: async () => (await api.health.$get()).json() });

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setBusy(false);
    if (res.error) setError(res.error.message ?? "Could not send the code");
    else setCodeSent(true);
  }

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await authClient.signIn.emailOtp({ email, otp: otp.trim() });
    setBusy(false);
    if (res.error) setError(res.error.message ?? "Could not sign in");
    else onSignedIn();
  }

  return (
    <main className="mx-auto mt-24 max-w-sm p-6">
      <h1 className="text-2xl font-bold">Conference planner</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">Sign in with a code sent to your email.</p>
      {health.data && !health.data.emailConfigured ? (
        <p className="mb-6 rounded border-2 border-amber-400 bg-amber-50 p-3 text-sm">
          <b>Email is not set up yet</b>, so sign-in codes can't be sent. The administrator needs
          to add the email settings (see the README, Email).
        </p>
      ) : null}
      {!codeSent ? (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <Input
            type="email"
            required
            placeholder="you@university.edu"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button disabled={busy}>Send sign-in code</Button>
        </form>
      ) : (
        <form onSubmit={signIn} className="flex flex-col gap-3">
          <p className="text-sm">
            We sent a 6-digit code to <b>{email}</b>.
          </p>
          <Input
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
          />
          <Button disabled={busy}>Sign in</Button>
          <Button type="button" variant="ghost" onClick={() => setCodeSent(false)}>
            Use another email
          </Button>
        </form>
      )}
      <div className="mt-3">
        <ErrorText error={error} />
      </div>
    </main>
  );
}
