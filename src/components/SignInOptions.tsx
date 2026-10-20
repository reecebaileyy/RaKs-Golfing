"use client";

import { useState } from "react";
import { AuthForm } from "./AuthForm";
import { CodeSignIn } from "./CodeSignIn";

/** Social buttons, then either a one-time code or the password form. */
export function SignInOptions({
  next,
  providers,
  defaultMethod,
}: {
  next: string;
  providers: { id: string; label: string }[];
  defaultMethod: "code" | "password";
}) {
  const [method, setMethod] = useState(defaultMethod);
  return (
    <div className="space-y-5">
      {providers.length > 0 && (
        <div className="space-y-2">
          {providers.map((p) => (
            <a
              key={p.id}
              href={`/api/auth/oauth/${p.id}/start?intent=signin&next=${encodeURIComponent(next)}`}
              className="block w-full rounded-xl border border-line bg-card px-5 py-3 text-center font-semibold"
            >
              Continue with {p.label}
            </a>
          ))}
          <p className="pt-1 text-center text-xs uppercase tracking-wide text-muted">or</p>
        </div>
      )}
      {method === "code" ? <CodeSignIn next={next} /> : <AuthForm mode="signin" next={next} />}
      <button
        type="button"
        onClick={() => setMethod(method === "code" ? "password" : "code")}
        className="w-full text-center text-sm font-medium text-fairway-600"
      >
        {method === "code" ? "Sign in with a password instead" : "Email or text me a code instead"}
      </button>
    </div>
  );
}
