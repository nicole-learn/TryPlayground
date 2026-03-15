export interface HostedRefundAdjustmentInput {
  purchaseAmountCents: number;
  purchaseCredits: number;
  refundedAmountCents: number;
  refundedCredits: number;
  targetRefundAmountCents: number;
}

export interface HostedRefundAdjustment {
  nextRefundedAmountCents: number;
  nextRefundedCredits: number;
  deltaCredits: number;
  fullyRefunded: boolean;
}

function toCreditTenths(credits: number) {
  return Math.max(0, Math.round(credits * 10));
}

function fromCreditTenths(tenths: number) {
  return tenths / 10;
}

export function calculateHostedRefundAdjustment(
  input: HostedRefundAdjustmentInput
): HostedRefundAdjustment {
  const totalAmountCents = Math.max(0, Math.trunc(input.purchaseAmountCents));
  const totalCreditTenths = toCreditTenths(input.purchaseCredits);
  const currentRefundedAmountCents = Math.max(
    0,
    Math.min(totalAmountCents, Math.trunc(input.refundedAmountCents))
  );
  const currentRefundedTenths = Math.max(
    0,
    Math.min(totalCreditTenths, toCreditTenths(input.refundedCredits))
  );
  const targetRefundAmountCents = Math.max(
    currentRefundedAmountCents,
    Math.min(totalAmountCents, Math.trunc(input.targetRefundAmountCents))
  );

  let targetRefundTenths = 0;
  if (totalAmountCents > 0 && totalCreditTenths > 0 && targetRefundAmountCents > 0) {
    targetRefundTenths = Math.ceil(
      (targetRefundAmountCents * totalCreditTenths) / totalAmountCents
    );
  }

  const clampedTargetRefundTenths = Math.min(totalCreditTenths, targetRefundTenths);
  const deltaCreditsTenths = Math.max(
    0,
    clampedTargetRefundTenths - currentRefundedTenths
  );

  return {
    nextRefundedAmountCents: targetRefundAmountCents,
    nextRefundedCredits: fromCreditTenths(clampedTargetRefundTenths),
    deltaCredits: fromCreditTenths(deltaCreditsTenths),
    fullyRefunded: targetRefundAmountCents >= totalAmountCents,
  };
}

export function buildHostedStripeCheckoutIdempotencyKey(purchaseId: string) {
  return `tryplayground:checkout_session:${purchaseId}`;
}
