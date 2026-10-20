import type { Metadata, Viewport } from "next";
import Link from "next/link";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <div className="mx-auto flex min-h-dvh max-w-md flex-col">
          <header className="sticky top-0 z-20 bg-fairway-700 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
            <Link href="/" className="text-lg font-bold tracking-tight">
              RaKs Golfing
            </Link>
          </header>
          <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
          <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto grid max-w-md grid-cols-2 text-center text-sm font-medium">
              <Link href="/" className="py-3">Book</Link>
              <Link href="/reservations" className="py-3">My tee times</Link>
            </div>
          </nav>
        </div>
      </body>
    </html>
  );
}
