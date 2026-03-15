import { requireSupabaseUser } from "@/lib/supabase/server";
import { getHostedSyncPayload } from "@/server/studio/hosted-store";
import { createStudioRouteError, toStudioErrorResponse } from "@/server/studio/studio-route-errors";

export const runtime = "nodejs";

const HOSTED_EVENTS_PULSE_MS = 1400;
const HOSTED_EVENTS_KEEPALIVE_MS = 15000;

function createSseMessage(event: string, payload: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export async function GET(request: Request) {
  try {
    const { supabase, user } = await requireSupabaseUser(request);
    const url = new URL(request.url);
    const rawSinceRevision = url.searchParams.get("sinceRevision");
    const sinceRevision =
      rawSinceRevision && rawSinceRevision.trim().length > 0
        ? Number.parseInt(rawSinceRevision, 10)
        : null;

    if (
      rawSinceRevision &&
      rawSinceRevision.trim().length > 0 &&
      (sinceRevision === null || !Number.isFinite(sinceRevision) || sinceRevision < 0)
    ) {
      createStudioRouteError(400, "The hosted event revision was invalid.");
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        let closed = false;
        let currentRevision =
          typeof sinceRevision === "number" && Number.isFinite(sinceRevision)
            ? sinceRevision
            : null;
        let tickTimeout: ReturnType<typeof setTimeout> | null = null;
        let keepAliveInterval: ReturnType<typeof setInterval> | null = null;

        const cleanup = () => {
          if (closed) {
            return;
          }

          closed = true;
          if (tickTimeout) {
            clearTimeout(tickTimeout);
            tickTimeout = null;
          }
          if (keepAliveInterval) {
            clearInterval(keepAliveInterval);
            keepAliveInterval = null;
          }
          try {
            controller.close();
          } catch {
            // Ignore close races on disconnected clients.
          }
        };

        const enqueue = (message: string) => {
          if (closed) {
            return;
          }

          controller.enqueue(encoder.encode(message));
        };

        const scheduleNextTick = () => {
          if (closed) {
            return;
          }

          tickTimeout = setTimeout(runTick, HOSTED_EVENTS_PULSE_MS);
        };

        const runTick = async () => {
          if (closed) {
            return;
          }

          try {
            const payload = await getHostedSyncPayload({
              supabase,
              user,
              webhookBaseUrl: url.origin,
              sinceRevision: currentRevision,
            });

            if (payload.kind !== "noop") {
              currentRevision = payload.revision;
              enqueue(createSseMessage("studio-sync", payload));
            }
          } catch (error) {
            enqueue(
              createSseMessage("studio-error", {
                message:
                  error instanceof Error
                    ? error.message
                    : "Hosted realtime sync failed.",
              })
            );
          } finally {
            scheduleNextTick();
          }
        };

        enqueue(": connected\n\n");
        keepAliveInterval = setInterval(() => {
          enqueue(": keepalive\n\n");
        }, HOSTED_EVENTS_KEEPALIVE_MS);

        request.signal.addEventListener("abort", cleanup);
        void runTick();
      },
      cancel() {
        // The abort listener handles cleanup.
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
      },
    });
  } catch (error) {
    return toStudioErrorResponse(error, "Could not open hosted realtime events.", 401);
  }
}
