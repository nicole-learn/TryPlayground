import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/supabase/server";
import { completeHostedCreditCheckoutSession } from "@/server/studio/hosted-billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { user } = await requireSupabaseUser(request);
    const payload = (await request.json()) as {
      checkoutSessionId?: string;
    };
    const checkoutSessionId = String(payload.checkoutSessionId ?? "").trim();

    if (!checkoutSessionId) {
      throw new Error("Stripe checkout session id is required.");
    }

    const result = await completeHostedCreditCheckoutSession({
      checkoutSessionId,
      expectedUserId: user.id,
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
            : "Could not complete the Stripe checkout session.",
      },
      { status: 400 }
    );
  }
}
