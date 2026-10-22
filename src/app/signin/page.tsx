import { SignInOptions } from "@/components/SignInOptions";
import { OAUTH_ERROR_TEXT, type OAuthErrorCode } from "@/lib/oauth/flow";
import { enabledProviders, PROVIDER_LABEL } from "@/lib/oauth/providers";
import { isWaitlistMode, safeNext } from "@/lib/siteMode";

type Params = Promise<{ next?: string; method?: string; oauth_error?: string }>;

export default async function Page({ searchParams }: { searchParams: Params }) {
  const { next, method, oauth_error } = await searchParams;
  const oauthError = OAUTH_ERROR_TEXT[oauth_error as OAuthErrorCode];
  // Waitlist accounts have no password, so they start on the code form.
  const defaultMethod = isWaitlistMode() || method === "code" ? "code" : "password";
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold">Sign in</h1>
      {oauthError && <p role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{oauthError}</p>}
      <SignInOptions
        next={safeNext(next, "/")}
        providers={enabledProviders().map((id) => ({ id, label: PROVIDER_LABEL[id] }))}
        defaultMethod={defaultMethod}
      />
    </div>
  );
}
