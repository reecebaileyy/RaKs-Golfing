import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { ArrivalBanner } from "@/components/ArrivalBanner";
import { getCurrentUser } from "@/lib/auth";
import type { Chrome } from "@/lib/siteMode";
import "./globals.css";

export const metadata: Metadata = {
  title: "RaKs Golfing",
  description: "Book tee times and compete for cash against golfers at your level.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#17602f",
};

const NAV = [
  { href: "/", label: "Book" },
  { href: "/matches", label: "Matches" },
  { href: "/live", label: "Live" },
  { href: "/leaderboard", label: "Leaders" },
  { href: "/profile", label: "Profile" },
];

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Set by middleware: the landing page draws its own page, and waitlist mode hides the app's tabs.
  const chrome = ((await headers()).get("x-raks-chrome") ?? "full") as Chrome;
  if (chrome === "none") {
    return (
      <html lang="en">
        <body className="font-sans antialiased">{children}</body>
      </html>
    );
  }
  const user = chrome === "full" ? await getCurrentUser() : null;
  if (chrome === "minimal") {
    return (
      <html lang="en">
        <body className="font-sans antialiased">
          <div className="mx-auto flex min-h-dvh max-w-md flex-col">
            <header className="bg-fairway-700 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
              <Link href="/" className="text-lg font-bold tracking-tight">
                RaKs Golfing
              </Link>
            </header>
            <main className="flex-1 px-4 pb-12 pt-4">{children}</main>
          </div>
        </body>
      </html>
    );
  }
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="mx-auto flex min-h-dvh max-w-md flex-col">
          <header className="sticky top-0 z-20 bg-fairway-700 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
            <div className="flex items-center justify-between">
              <Link href="/" className="text-lg font-bold tracking-tight">
                RaKs Golfing
              </Link>
              {user ? (
                <Link href="/wallet" className="text-sm font-medium text-white/90">Wallet</Link>
              ) : (
                <Link href="/signin" className="text-sm font-medium text-white/90">Sign in</Link>
              )}
            </div>
          </header>
          <main className="flex-1 px-4 pb-28 pt-4">
            <ArrivalBanner />
            {children}
          </main>
          <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto grid max-w-md grid-cols-5 text-center text-xs font-medium">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="py-3">{item.label}</Link>
              ))}
            </div>
          </nav>
        </div>
      </body>
    </html>
  );
}
