import { normalizeChallengeContext, decodePaymentRequest, encodePaymentCredential } from "./payment-header.js";
import type {
  LightningChargeCredentialPayload,
  LightningChargeMethodDetails,
  LightningSessionBearerPayload,
  LightningSessionClosePayload,
  LightningSessionCredentialPayload,
  LightningSessionMethodDetails,
  LightningSessionOpenPayload,
  LightningSessionTopUpPayload,
  PaymentChallengeContext,
  PaymentCredential,
  PaymentRequestEnvelope,
} from "./types.js";

function ensureLightningIntent(context: PaymentChallengeContext, intent: "charge" | "session"): void {
  if (context.method !== "lightning") {
    throw new Error(`Expected lightning method, received ${context.method}`);
  }
  if (context.intent !== intent) {
    throw new Error(`Expected ${intent} intent, received ${context.intent}`);
  }
}

export function decodeLightningChargeRequest(
  context: PaymentChallengeContext,
): PaymentRequestEnvelope & { methodDetails: LightningChargeMethodDetails } {
  ensureLightningIntent(context, "charge");
  return decodePaymentRequest<PaymentRequestEnvelope & { methodDetails: LightningChargeMethodDetails }>(
    context.request,
  );
}

export function decodeLightningSessionRequest(
  context: PaymentChallengeContext,
): PaymentRequestEnvelope & { methodDetails: LightningSessionMethodDetails } {
  ensureLightningIntent(context, "session");
  return decodePaymentRequest<PaymentRequestEnvelope & { methodDetails: LightningSessionMethodDetails }>(
    context.request,
  );
}

export function createLightningChargeCredential(input: {
  challenge: PaymentChallengeContext;
  preimage: string;
  source?: string | undefined;
}): PaymentCredential<LightningChargeCredentialPayload> {
  ensureLightningIntent(input.challenge, "charge");
  return {
    challenge: normalizeChallengeContext(input.challenge),
    source: input.source,
    payload: {
      preimage: input.preimage,
    },
  };
}

export function encodeLightningChargeCredential(input: {
  challenge: PaymentChallengeContext;
  preimage: string;
  source?: string | undefined;
}): string {
  return encodePaymentCredential(createLightningChargeCredential(input));
}

export function createLightningSessionOpenCredential(input: {
  challenge: PaymentChallengeContext;
  preimage: string;
  returnInvoice?: string | undefined;
  returnLightningAddress?: string | undefined;
  source?: string | undefined;
}): PaymentCredential<LightningSessionOpenPayload> {
  ensureLightningIntent(input.challenge, "session");
  if (!input.returnInvoice && !input.returnLightningAddress) {
    throw new Error("Session open requires returnInvoice or returnLightningAddress");
  }
  return {
    challenge: normalizeChallengeContext(input.challenge),
    source: input.source,
    payload: {
      action: "open",
      preimage: input.preimage,
      returnInvoice: input.returnInvoice,
      returnLightningAddress: input.returnLightningAddress,
    },
  };
}

export function createLightningSessionBearerCredential(input: {
  challenge: PaymentChallengeContext;
  sessionId: string;
  preimage: string;
  source?: string | undefined;
}): PaymentCredential<LightningSessionBearerPayload> {
  ensureLightningIntent(input.challenge, "session");
  return {
    challenge: normalizeChallengeContext(input.challenge),
    source: input.source,
    payload: {
      action: "bearer",
      sessionId: input.sessionId,
      preimage: input.preimage,
    },
  };
}

export function createLightningSessionTopUpCredential(input: {
  challenge: PaymentChallengeContext;
  sessionId: string;
  topUpPreimage: string;
  source?: string | undefined;
}): PaymentCredential<LightningSessionTopUpPayload> {
  ensureLightningIntent(input.challenge, "session");
  return {
    challenge: normalizeChallengeContext(input.challenge),
    source: input.source,
    payload: {
      action: "topUp",
      sessionId: input.sessionId,
      topUpPreimage: input.topUpPreimage,
    },
  };
}

export function createLightningSessionCloseCredential(input: {
  challenge: PaymentChallengeContext;
  sessionId: string;
  preimage: string;
  source?: string | undefined;
}): PaymentCredential<LightningSessionClosePayload> {
  ensureLightningIntent(input.challenge, "session");
  return {
    challenge: normalizeChallengeContext(input.challenge),
    source: input.source,
    payload: {
      action: "close",
      sessionId: input.sessionId,
      preimage: input.preimage,
    },
  };
}

export function encodeLightningSessionCredential(
  credential: PaymentCredential<LightningSessionCredentialPayload>,
): string {
  return encodePaymentCredential(credential);
}
