import { NextResponse } from "next/server";
import { handleHostedStripeWebhook } from "@/server/studio/hosted-billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const result = await handleHostedStripeWebhook(request);
    const response = NextResponse.json({ ok: true, ...result });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Stripe webhook processing failed.",
      },
      { status: 400 }
    );
  }
}
