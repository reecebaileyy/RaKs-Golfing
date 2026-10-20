// Payment boundary. The baseline uses a fake provider so the flow runs end to end
// without real cards; a Stripe implementation can drop in behind the same interface.

export interface ChargeRequest {
  amountCents: number;
  description: string;
  customerEmail?: string;
}

export interface PaymentProvider {
  charge(req: ChargeRequest): Promise<{ ok: true; ref: string } | { ok: false; error: string }>;
  refund(ref: string, amountCents: number): Promise<{ ok: boolean }>;
}

export const fakePayments: PaymentProvider = {
  async charge(req) {
    if (req.amountCents === 0) return { ok: true, ref: "none" };
    return { ok: true, ref: `fake_${crypto.randomUUID().slice(0, 12)}` };
  },
  async refund() {
    return { ok: true };
  },
};

export const payments: PaymentProvider = fakePayments;
