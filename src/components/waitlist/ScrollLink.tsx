"use client";

/** An in-page link that scrolls smoothly (unless the visitor prefers less motion) and moves focus to the target. */
export function ScrollLink({ to, className, children }: { to: string; className?: string; children: React.ReactNode }) {
  return (
    <a
      href={`#${to}`}
      className={className}
      onClick={(e) => {
        const target = document.getElementById(to);
        if (!target) return;
        e.preventDefault();
        const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
        target.focus({ preventScroll: true });
      }}
    >
      {children}
    </a>
  );
}
