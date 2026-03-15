import { NextResponse } from "next/server";
import {
  createSupabaseAdminClient,
  createSupabaseRouteHandlerClient,
} from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_FEEDBACK_LENGTH = 4000;

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      message?: unknown;
    };
    const message =
      typeof payload.message === "string" ? payload.message.trim() : "";

    if (!message) {
      throw new Error("Feedback message is required.");
    }

    if (message.length > MAX_FEEDBACK_LENGTH) {
      throw new Error(`Feedback must be ${MAX_FEEDBACK_LENGTH} characters or fewer.`);
    }

    const routeSupabase = await createSupabaseRouteHandlerClient();
    const {
      data: { user },
    } = await routeSupabase.auth.getUser();

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("feedback_submissions").insert({
      message,
      user_id: user?.id ?? null,
    });

    if (error) {
      throw new Error(error.message);
    }

    const response = NextResponse.json({ ok: true });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not submit feedback.",
      },
      { status: 400 }
    );
  }
}
