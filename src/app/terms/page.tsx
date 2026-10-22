import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of use | RaKs Golfing",
  description: "The rules for joining the RaKs Golfing waitlist and posting on the Golf talk wall.",
};

export default function TermsPage() {
  const contactEmail = process.env.CONTACT_EMAIL;
  const contact = contactEmail ? (
    <a href={`mailto:${contactEmail}`} className="font-medium text-fairway-600 underline">{contactEmail}</a>
  ) : (
    "the email on our site"
  );

  return (
    <article className="space-y-6 text-sm leading-relaxed">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Terms of use</h1>
        <p className="text-muted">Last updated October 20, 2026</p>
      </header>

      <p>These terms cover the RaKs Golfing waitlist and the Golf talk wall. By joining or posting, you agree to them.</p>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">The waitlist</h2>
        <p>
          RaKs Golfing is not open yet. Right now you can join the waitlist and post on the wall. It costs nothing to join.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">No guarantees</h2>
        <p>
          Joining the list does not guarantee you access, and we haven&apos;t promised a launch date. Dates, plans and features can change, and we can change or
          end the waitlist.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Money matches</h2>
        <p>
          Money matches will only launch in places where they are allowed. They may not be available where you live, and you will need to be 18 or older, or
          older if your state requires it. You must be at least 13 to join the waitlist.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Your account</h2>
        <p>
          Joining creates an account tied to the login you chose: your email, your phone number, or your X, TikTok or Instagram account. At launch you sign in
          the same way. Give us true details, keep your sign-in codes to yourself, and you&apos;re responsible for what happens on your account.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Golf talk wall</h2>
        <p>Comments are public. Keep it friendly and about golf. Please don&apos;t post:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Spam or ads.</li>
          <li>Links. The wall doesn&apos;t accept them.</li>
          <li>Harassment, threats or hate toward anyone.</li>
          <li>Other people&apos;s private information.</li>
        </ul>
        <p>
          You keep what you write, and you let us show it on the site. We can hide any comment, and we may limit posting or close an account for repeated
          problems.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Changes to these terms</h2>
        <p>We may update these terms as we get ready to launch. We&apos;ll change the date at the top when we do. If you keep using the site after that, you accept the update.</p>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Contact</h2>
        <p>Questions about these terms? Send us a message at {contact}.</p>
      </section>

      <p className="text-muted">
        See also the <Link href="/privacy" className="font-medium text-fairway-600 underline">privacy policy</Link>.
      </p>
    </article>
  );
}
