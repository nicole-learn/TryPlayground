import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/supabase/server";
import { createHostedCreditCheckoutSession } from "@/server/studio/hosted-billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireSupabaseUser(request);

    let payload: {
      successPath?: string;
      cancelPath?: string;
    } = {};

    try {
      payload = (await request.json()) as typeof payload;
    } catch {
      payload = {};
    }

    const result = await createHostedCreditCheckoutSession({
      request,
      supabase,
      user,
      successPath: payload.successPath,
      cancelPath: payload.cancelPath,
    });

    const response = NextResponse.json(result);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create the Stripe Checkout session.",
      },
      { status: 400 }
    );
  }
}
