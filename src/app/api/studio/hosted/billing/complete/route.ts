import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/supabase/server";
import { completeHostedCreditCheckoutSession } from "@/server/studio/hosted-billing";
import { parseHostedCheckoutCompletePayload } from "@/server/studio/studio-request-validation";
import { toStudioErrorResponse } from "@/server/studio/studio-route-errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { user } = await requireSupabaseUser(request);
    const payload = parseHostedCheckoutCompletePayload(await request.json());
    const checkoutSessionId = payload.checkoutSessionId;

    const result = await completeHostedCreditCheckoutSession({
      checkoutSessionId,
      expectedUserId: user.id,
    });

    const response = NextResponse.json(result);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return toStudioErrorResponse(error, "Could not complete the Stripe checkout session.");
  }
}
