import { getLiveView } from "@/lib/live";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const POLL_MS = 2000;
const HEARTBEAT_MS = 15_000;

/** Server-Sent Events: pushes the live view whenever it changes. The DB is polled here so clients don't have to. */
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!(await getLiveView(code))) return new Response("Match not found.", { status: 404 });

  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let last = "";
  let lastSent = Date.now();
  let busy = false;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(timer);
        try {
          controller.close();
        } catch {}
      };
      const tick = async () => {
        if (busy || closed) return;
        busy = true;
        try {
          const view = await getLiveView(code);
          const json = JSON.stringify(view);
          if (json !== last) {
            last = json;
            lastSent = Date.now();
            controller.enqueue(encoder.encode(`data: ${json}\n\n`));
          } else if (Date.now() - lastSent >= HEARTBEAT_MS) {
            lastSent = Date.now();
            controller.enqueue(encoder.encode(`: heartbeat\n\n`));
          }
        } catch {
          close();
        } finally {
          busy = false;
        }
      };
      void tick();
      timer = setInterval(tick, POLL_MS);
      req.signal.addEventListener("abort", close);
    },
    cancel() {
      closed = true;
      clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
