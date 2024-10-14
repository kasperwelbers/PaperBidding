"use client";

import { Button } from "@/components/ui/button";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function EmailSigninPage() {
  return (
    <Suspense>
      <EmailSignin />
    </Suspense>
  );
}

function EmailSignin() {
  const searchParams = useSearchParams();

  const token = searchParams.get("token") || "";
  const callbackUrl = searchParams.get("callbackUrl") || "";
  const email = searchParams.get("email") || "";

  return (
    <main className="flex min-h-screen flex-col items-center">
      <div className="w-full bg-secondary p-8 border-b-2 border-primary">
        <h1 className="text-5xl font-bold mb-2 text-center">Paper Bidding</h1>
        <h4 className="text-center mt-4 mb-0">
          Paper bidding website of the ICA Computational Methods Division
        </h4>
      </div>
      <div className="mt-20">
        <form action="/api/auth/callback/email" method="get">
          <h1>Sign in with your email</h1>
          {/* remove `type` and `value` if you want the user to type this manually */}
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <input type="hidden" name="email" value={email} />
          <Button type="submit" className="w-full">
            Complete sign in
          </Button>
        </form>
      </div>
    </main>
  );
}
