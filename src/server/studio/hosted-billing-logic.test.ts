import { describe, expect, it } from "vitest";
import {
  buildHostedStripeCheckoutIdempotencyKey,
  calculateHostedRefundAdjustment,
} from "./hosted-billing-logic";

describe("calculateHostedRefundAdjustment", () => {
  it("returns no delta when no refund has been applied", () => {
    expect(
      calculateHostedRefundAdjustment({
        purchaseAmountCents: 1000,
        purchaseCredits: 100,
        refundedAmountCents: 0,
        refundedCredits: 0,
        targetRefundAmountCents: 0,
      })
    ).toEqual({
      nextRefundedAmountCents: 0,
      nextRefundedCredits: 0,
      deltaCredits: 0,
      fullyRefunded: false,
    });
  });

  it("converts a partial refund into the matching partial credit delta", () => {
    expect(
      calculateHostedRefundAdjustment({
        purchaseAmountCents: 1000,
        purchaseCredits: 100,
        refundedAmountCents: 0,
        refundedCredits: 0,
        targetRefundAmountCents: 250,
      })
    ).toEqual({
      nextRefundedAmountCents: 250,
      nextRefundedCredits: 25,
      deltaCredits: 25,
      fullyRefunded: false,
    });
  });

  it("only applies the incremental difference for later partial refunds", () => {
    expect(
      calculateHostedRefundAdjustment({
        purchaseAmountCents: 1000,
        purchaseCredits: 100,
        refundedAmountCents: 250,
        refundedCredits: 25,
        targetRefundAmountCents: 600,
      })
    ).toEqual({
      nextRefundedAmountCents: 600,
      nextRefundedCredits: 60,
      deltaCredits: 35,
      fullyRefunded: false,
    });
  });

  it("rounds up to the nearest tenth of a credit when the refund ratio is uneven", () => {
    expect(
      calculateHostedRefundAdjustment({
        purchaseAmountCents: 999,
        purchaseCredits: 100,
        refundedAmountCents: 0,
        refundedCredits: 0,
        targetRefundAmountCents: 333,
      })
    ).toEqual({
      nextRefundedAmountCents: 333,
      nextRefundedCredits: 33.4,
      deltaCredits: 33.4,
      fullyRefunded: false,
    });
  });

  it("caps the refund at the full purchase amount and credits", () => {
    expect(
      calculateHostedRefundAdjustment({
        purchaseAmountCents: 1000,
        purchaseCredits: 100,
        refundedAmountCents: 25,
        refundedCredits: 2.5,
        targetRefundAmountCents: 5000,
      })
    ).toEqual({
      nextRefundedAmountCents: 1000,
      nextRefundedCredits: 100,
      deltaCredits: 97.5,
      fullyRefunded: true,
    });
  });
});

describe("buildHostedStripeCheckoutIdempotencyKey", () => {
  it("creates a stable checkout session key per purchase", () => {
    expect(buildHostedStripeCheckoutIdempotencyKey("purchase_123")).toBe(
      "tryplayground:checkout_session:purchase_123"
    );
  });
});
