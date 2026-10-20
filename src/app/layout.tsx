import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { ArrivalBanner } from "@/components/ArrivalBanner";
import { getCurrentUser } from "@/lib/auth";
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
  const user = await getCurrentUser();
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
