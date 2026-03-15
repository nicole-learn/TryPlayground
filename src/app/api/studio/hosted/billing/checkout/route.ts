import { NextResponse } from "next/server";
import { requireSupabaseUser } from "@/lib/supabase/server";
import { createHostedCreditCheckoutSession } from "@/server/studio/hosted-billing";
import { parseHostedCheckoutPayload } from "@/server/studio/studio-request-validation";
import { toStudioErrorResponse } from "@/server/studio/studio-route-errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireSupabaseUser(request);

    let payload: {
      successPath?: string;
      cancelPath?: string;
      checkoutRequestId?: string;
    } = {};

    try {
      payload = parseHostedCheckoutPayload(await request.json());
    } catch {
      payload = {};
    }

    const result = await createHostedCreditCheckoutSession({
      request,
      supabase,
      user,
      successPath: payload.successPath,
      cancelPath: payload.cancelPath,
      checkoutRequestId: payload.checkoutRequestId,
    });

    const response = NextResponse.json(result);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return toStudioErrorResponse(error, "Could not create the Stripe Checkout session.");
  }
}
