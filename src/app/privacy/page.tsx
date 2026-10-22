import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy policy | RaKs Golfing",
  description: "What the RaKs Golfing waitlist collects, why, and how to ask us to delete it.",
};

export default function PrivacyPage() {
  const contactEmail = process.env.CONTACT_EMAIL;
  const contact = contactEmail ? (
    <a href={`mailto:${contactEmail}`} className="font-medium text-fairway-600 underline">{contactEmail}</a>
  ) : (
    "the email on our site"
  );

  return (
    <article className="space-y-6 text-sm leading-relaxed">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Privacy policy</h1>
        <p className="text-muted">Last updated October 20, 2026</p>
      </header>

      <p>
        RaKs Golfing is not open yet. This page explains what we collect when you join the waitlist or post on the Golf talk wall, and what we do with it.
        The short version: we use it to hold your spot and let you know about launch, and we don&apos;t sell it.
      </p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">What we collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>Your name.</li>
          <li>Your email address, your phone number, or both. You need at least one.</li>
          <li>Your ZIP code and how often you play, if you choose to tell us.</li>
          <li>
            If you sign up with X, TikTok or Instagram: the profile id, username, display name and avatar that account shares with us. We don&apos;t post
            anything to your account.
          </li>
          <li>Comments you post on the Golf talk wall. They show with your first name and last initial.</li>
          <li>
            Where you came from: the code on a friend&apos;s invite link, or the campaign details (source, medium and campaign name) on the link you
            clicked.
          </li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Why we collect it</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>To hold your spot on the list and create your account.</li>
          <li>To contact you about launch.</li>
          <li>To see how much interest there is in each area and which links bring people in.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Sign-in codes and texts</h2>
        <p>
          To sign in, we send a one-time code by email or text to the address or number on your account. If you give us a phone number, we may text you
          that code and updates about launch. Message and data rates may apply. Reply STOP to any text to opt out.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Who sees it</h2>
        <p>
          We don&apos;t sell your personal information. We use outside services to host the site and to send emails and texts, and they only get what they need
          to do that job for us. Your comments are public on the wall under your first name and last initial.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Cookies</h2>
        <p>We use two kinds of cookies:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>A sign-in session cookie, so you stay signed in.</li>
          <li>A referral and campaign cookie, kept for 30 days, so we know which friend&apos;s link or campaign brought you.</li>
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Deleting your information</h2>
        <p>
          To ask us to delete your waitlist entry, comments and account details, send us a message at {contact}. Use the email or phone number on your account so
          we can tell it&apos;s you. We&apos;ll delete what we can, except anything we are required to keep.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Age</h2>
        <p>
          You must be at least 13 to join the waitlist. Playing money matches will require you to be 18 or older, or older if your state requires it.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Changes</h2>
        <p>If we change this page, we&apos;ll update the date at the top.</p>
      </section>

      <p className="text-muted">
        See also the <Link href="/terms" className="font-medium text-fairway-600 underline">terms of use</Link>.
      </p>
    </article>
  );
}
