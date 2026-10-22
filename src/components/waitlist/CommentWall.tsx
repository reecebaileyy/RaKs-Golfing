import type { WallComment } from "@/lib/waitlist";
import { CommentForm } from "./CommentForm";
import { ScrollLink } from "./ScrollLink";
import { timeAgo } from "./timeAgo";

/** The golf talk wall: a form for signed-in golfers and the newest takes. */
export function CommentWall({ comments, signedIn, now }: { comments: WallComment[]; signedIn: boolean; now: Date }) {
  return (
    <section id="golf-talk" aria-labelledby="golf-talk-heading" className="mx-auto w-full max-w-2xl scroll-mt-6 px-4 py-12">
      <h2 id="golf-talk-heading" className="text-2xl font-bold tracking-tight">
        Golf talk
      </h2>
      <p className="mt-1 text-muted">Best round, worst hole, home course? Tell the clubhouse.</p>

      <div className="card mt-5 p-4 sm:p-5">
        {signedIn ? (
          <CommentForm />
        ) : (
          <p className="text-sm">
            <ScrollLink to="join" className="font-semibold text-fairway-700 underline dark:text-fairway-100">
              Join the waitlist
            </ScrollLink>{" "}
            to post.
          </p>
        )}
      </div>

      {comments.length === 0 ? (
        <p className="mt-6 text-center text-muted">No takes yet. Be the first.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {comments.map((c) => (
            <li key={c.id} data-testid="golf-comment" className="card p-4">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="font-semibold">
                  {c.author}
                  {c.mine && (
                    <span className="ml-2 rounded-full bg-fairway-100 px-2 py-0.5 text-xs font-medium text-fairway-900 dark:bg-fairway-900 dark:text-fairway-100">
                      You
                    </span>
                  )}
                </span>
                <time dateTime={c.createdAt.toISOString()} className="shrink-0 text-xs text-muted">
                  {timeAgo(c.createdAt, now)}
                </time>
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
