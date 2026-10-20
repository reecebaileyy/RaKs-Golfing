"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/auth/signout", { method: "POST" });
        router.replace("/");
        router.refresh();
      }}
      className="text-sm text-muted underline"
    >
      Sign out
    </button>
  );
}
