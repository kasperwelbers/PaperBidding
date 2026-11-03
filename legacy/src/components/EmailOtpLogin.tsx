"use client";

import { authClient } from "@/auth/authClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Mail, MailCheck } from "lucide-react";
import { useEffect, useState } from "react";

const SENDER = "paperbidding@ica-cm.com";
const STORAGE_KEY = "paperbidding-otp-login";
const CODE_VALID_MS = 10 * 60 * 1000;

interface Props {
  /** Called after the user signed in successfully */
  callback?: () => void;
}

interface StoredState {
  email: string;
  sentAt: number;
}

/** Remember that a code was sent, so that the code form survives a page
 *  reload (e.g., mobile browsers discarding the tab while reading email) */
function storeSent(email: string) {
  const state: StoredState = { email, sentAt: Date.now() };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function loadSent(): StoredState | null {
  try {
    const state: StoredState = JSON.parse(
      sessionStorage.getItem(STORAGE_KEY) || "null",
    );
    if (state && Date.now() - state.sentAt < CODE_VALID_MS) return state;
  } catch {}
  return null;
}
function clearSent() {
  sessionStorage.removeItem(STORAGE_KEY);
}

/** Two step sign-in: enter email, then enter the code that was emailed */
export function EmailOtpLogin({ callback }: Props) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resent, setResent] = useState(false);

  useEffect(() => {
    const sent = loadSent();
    if (!sent) return;
    setEmail(sent.email);
    setStep("code");
  }, []);

  async function sendCode() {
    setBusy(true);
    setError("");
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: "sign-in",
    });
    setBusy(false);
    if (error) {
      setError(
        error.status === 429
          ? "Too many requests. Please wait a minute and try again."
          : error.message || "Could not send the email. Please try again.",
      );
      return false;
    }
    storeSent(email.trim());
    return true;
  }

  async function onSubmitEmail(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (await sendCode()) {
      setOtp("");
      setResent(false);
      setStep("code");
    }
  }

  async function onSubmitCode(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await authClient.signIn.emailOtp({
      email: email.trim(),
      otp: otp.trim(),
    });
    setBusy(false);
    if (error) {
      if (error.code === "TOO_MANY_ATTEMPTS") {
        setError("Too many wrong attempts. Please request a new code.");
      } else if (error.code === "OTP_EXPIRED") {
        setError("This code has expired. Please request a new code.");
      } else {
        setError("Invalid code. Please check the code and try again.");
      }
      return;
    }
    clearSent();
    callback?.();
  }

  async function onResend() {
    if (await sendCode()) {
      setOtp("");
      setResent(true);
    }
  }

  function onChangeEmail() {
    clearSent();
    setError("");
    setOtp("");
    setStep("email");
  }

  const card =
    "w-full max-w-md mx-auto rounded-xl border bg-background shadow-lg p-6 sm:p-8 flex flex-col gap-5";
  const errorMsg = error ? (
    <p className="text-destructive text-sm text-center m-0">{error}</p>
  ) : null;

  if (step === "email") {
    return (
      <form className={card} onSubmit={onSubmitEmail}>
        <div className="flex flex-col items-center text-center gap-2">
          <div className="rounded-full bg-secondary p-3">
            <Mail className="h-7 w-7 text-primary" />
          </div>
          <h3 className="m-0">Sign in</h3>
          <p className="m-0 text-sm opacity-80">
            Enter your email address, and we&apos;ll send you a 6-digit sign-in
            code.
          </p>
        </div>
        <Input
          id="email"
          className="h-12 text-base"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="name@university.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Button className="h-12 text-base" disabled={!email || busy}>
          {busy ? "Sending..." : "Send sign-in code"}
        </Button>
        {errorMsg}
      </form>
    );
  }

  return (
    <form className={card} onSubmit={onSubmitCode}>
      <div className="flex flex-col items-center text-center gap-2">
        <div className="rounded-full bg-secondary p-3">
          <MailCheck className="h-7 w-7 text-primary" />
        </div>
        <h3 className="m-0">Check your email</h3>
        <p className="m-0">
          We sent a 6-digit code to
          <br />
          <b className="break-all">{email}</b>
        </p>
      </div>

      <div className="rounded-lg bg-secondary p-4 text-sm flex flex-col gap-1">
        <b>Can&apos;t find the email?</b>
        <span>
          Please check your <b>spam or junk folder</b>. The email comes from{" "}
          <b className="whitespace-nowrap">{SENDER}</b>, and can take a few
          minutes to arrive.
        </span>
      </div>

      <Input
        id="otp"
        aria-label="Sign-in code"
        className="h-14 tracking-[0.5em] text-center text-2xl font-bold"
        name="otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]{6}"
        maxLength={6}
        placeholder="000000"
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
        autoFocus
        required
      />
      <Button className="h-12 text-base" disabled={otp.length !== 6 || busy}>
        {busy ? "Checking..." : "Sign in"}
      </Button>
      {errorMsg}
      {resent && !error ? (
        <p className="text-sm text-center m-0">A new code has been sent.</p>
      ) : null}
      <div className="flex justify-between border-t pt-3">
        <Button
          type="button"
          variant="link"
          className="px-0 h-auto"
          disabled={busy}
          onClick={onResend}
        >
          Resend code
        </Button>
        <Button
          type="button"
          variant="link"
          className="px-0 h-auto"
          disabled={busy}
          onClick={onChangeEmail}
        >
          Use another email
        </Button>
      </div>
    </form>
  );
}
