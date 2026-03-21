import {
  createLightningChargeCredential,
  createLightningSessionBearerCredential,
  createLightningSessionCloseCredential,
  createLightningSessionOpenCredential,
  createLightningSessionTopUpCredential,
  decodeLightningChargeRequest,
  decodeLightningSessionRequest,
  encodeLightningChargeCredential,
  encodeLightningSessionCredential,
} from "./lightning.js";
import type {
  LightningInvoicePaymentResult,
  LightningProviderAdapter,
  PaymentChallengeContext,
} from "./types.js";

export interface LightningSessionHandle {
  sessionId: string;
  preimage: string;
  paymentHash: string;
  returnInvoice?: string | undefined;
  returnLightningAddress?: string | undefined;
  depositAmountSats?: number | undefined;
}

export interface PaidLightningCharge {
  authorization: string;
  preimage: string;
  paymentHash: string;
  amountSats?: number | undefined;
}

export async function payLightningChargeChallenge(input: {
  challenge: PaymentChallengeContext;
  adapter: LightningProviderAdapter;
  source?: string | undefined;
}): Promise<PaidLightningCharge> {
  const request = decodeLightningChargeRequest(input.challenge);
  const invoice = request.methodDetails.invoice;
  const payment = await input.adapter.payInvoice(invoice);

  return {
    authorization: encodeLightningChargeCredential({
      challenge: input.challenge,
      preimage: payment.preimage,
      source: input.source,
    }),
    preimage: payment.preimage,
    paymentHash: payment.paymentHash,
    amountSats:
      typeof request.amount === "string" ? Number.parseInt(request.amount, 10) : undefined,
  };
}

export async function openLightningSession(input: {
  challenge: PaymentChallengeContext;
  adapter: LightningProviderAdapter;
  source?: string | undefined;
  returnInvoice?: string | undefined;
  returnLightningAddress?: string | undefined;
}): Promise<LightningSessionHandle & { authorization: string }> {
  const request = decodeLightningSessionRequest(input.challenge);
  const invoice = request.methodDetails.depositInvoice;
  if (!invoice) {
    throw new Error("Session challenge missing depositInvoice");
  }

  const payment = await input.adapter.payInvoice(invoice);
  let returnInvoice = input.returnInvoice;
  const returnLightningAddress = input.returnLightningAddress;

  if (!returnInvoice && !returnLightningAddress) {
    returnInvoice = (
      await input.adapter.createInvoice({
        amountSats: 0,
        description: "MPP session return invoice",
      })
    ).invoice;
  }

  return {
    sessionId: request.methodDetails.paymentHash,
    preimage: payment.preimage,
    paymentHash: payment.paymentHash,
    returnInvoice,
    returnLightningAddress,
    depositAmountSats:
      typeof request.methodDetails.depositAmount === "string"
        ? Number.parseInt(request.methodDetails.depositAmount, 10)
        : undefined,
    authorization: encodeLightningSessionCredential(
      createLightningSessionOpenCredential({
        challenge: input.challenge,
        preimage: payment.preimage,
        returnInvoice,
        returnLightningAddress,
        source: input.source,
      }),
    ),
  };
}

export function createLightningSessionBearerAuthorization(input: {
  challenge: PaymentChallengeContext;
  session: LightningSessionHandle;
  source?: string | undefined;
}): string {
  return encodeLightningSessionCredential(
    createLightningSessionBearerCredential({
      challenge: input.challenge,
      sessionId: input.session.sessionId,
      preimage: input.session.preimage,
      source: input.source,
    }),
  );
}

export async function topUpLightningSession(input: {
  challenge: PaymentChallengeContext;
  session: LightningSessionHandle;
  adapter: LightningProviderAdapter;
  source?: string | undefined;
}): Promise<{ authorization: string; topUpPreimage: string; paymentHash: string }> {
  const request = decodeLightningSessionRequest(input.challenge);
  const invoice = request.methodDetails.depositInvoice;
  if (!invoice) {
    throw new Error("Top-up challenge missing depositInvoice");
  }

  const payment = await input.adapter.payInvoice(invoice);
  return {
    authorization: encodeLightningSessionCredential(
      createLightningSessionTopUpCredential({
        challenge: input.challenge,
        sessionId: input.session.sessionId,
        topUpPreimage: payment.preimage,
        source: input.source,
      }),
    ),
    topUpPreimage: payment.preimage,
    paymentHash: payment.paymentHash,
  };
}

export function closeLightningSession(input: {
  challenge: PaymentChallengeContext;
  session: LightningSessionHandle;
  source?: string | undefined;
}): string {
  return encodeLightningSessionCredential(
    createLightningSessionCloseCredential({
      challenge: input.challenge,
      sessionId: input.session.sessionId,
      preimage: input.session.preimage,
      source: input.source,
    }),
  );
}

export async function refundLightningSessionBalance(input: {
  adapter: LightningProviderAdapter;
  amountSats: number;
  returnInvoice?: string | undefined;
  returnLightningAddress?: string | undefined;
}): Promise<LightningInvoicePaymentResult> {
  if (input.amountSats < 0) {
    throw new Error("Refund amount must be non-negative");
  }

  if (input.returnInvoice) {
    return input.adapter.payInvoice(input.returnInvoice, {
      amountSats: input.amountSats,
    });
  }

  if (input.returnLightningAddress) {
    if (!input.adapter.payLightningAddress) {
      throw new Error("Adapter does not support Lightning Address refunds");
    }

    return input.adapter.payLightningAddress(
      input.returnLightningAddress,
      input.amountSats,
    );
  }

  throw new Error("Refund requires returnInvoice or returnLightningAddress");
}
