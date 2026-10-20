const STEPS = [
  {
    title: "Book a tee time",
    body: "Find a course and a time that works. Every tee time you book can be a match.",
  },
  {
    title: "Every round is a match",
    body: "1v1 or 2v2, stroke or match play, from a $20 stake. Threesomes play nine point.",
  },
  {
    title: "Fair by handicap",
    body: "Add your GHIN number or your last 5 rounds. Strokes follow the current USGA rules, so you play golfers at your level.",
  },
  {
    title: "Live from the first tee",
    body: "GPS scorecard, live leaderboard, and the ALOHA PRESS: once the match is closed, the losing side can press once.",
  },
];

export function HowItWorks() {
  return (
    <section aria-labelledby="how-heading" className="mx-auto w-full max-w-6xl px-4 py-12">
      <h2 id="how-heading" className="text-2xl font-bold tracking-tight">
        How it works
      </h2>
      <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.title} className="card p-5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-full bg-fairway-100 font-bold text-fairway-900 dark:bg-fairway-900 dark:text-fairway-100"
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
