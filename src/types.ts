export type MppxIntent = "charge" | "session";

export type MppxPaymentMethod = "lightning";

export type LightningSessionAction = "open" | "bearer" | "topUp" | "close";

export interface PaymentChallengeContext {
  id: string;
  realm: string;
  method: MppxPaymentMethod;
  intent: MppxIntent;
  request: string;
  expires?: string | undefined;
}

export interface PaymentRequestEnvelope {
  amount: string;
  currency: string;
  description?: string | undefined;
  unitType?: string | undefined;
  methodDetails?: Record<string, unknown> | undefined;
  [key: string]: unknown;
}

export interface LightningChargeMethodDetails {
  invoice: string;
  paymentHash?: string | undefined;
  network?: "mainnet" | "regtest" | "signet" | undefined;
}

export interface LightningSessionMethodDetails {
  depositInvoice?: string | undefined;
  paymentHash: string;
  depositAmount?: string | undefined;
  idleTimeout?: string | undefined;
}

export interface PaymentCredential<TPayload extends object> {
  challenge: PaymentChallengeContext;
  source?: string | undefined;
  payload: TPayload;
}

export interface LightningChargeCredentialPayload {
  preimage: string;
}

export interface LightningSessionOpenPayload {
  action: "open";
  preimage: string;
  returnInvoice?: string | undefined;
  returnLightningAddress?: string | undefined;
}

export interface LightningSessionBearerPayload {
  action: "bearer";
  sessionId: string;
  preimage: string;
}

export interface LightningSessionTopUpPayload {
  action: "topUp";
  sessionId: string;
  topUpPreimage: string;
}

export interface LightningSessionClosePayload {
  action: "close";
  sessionId: string;
  preimage: string;
}

export type LightningSessionCredentialPayload =
  | LightningSessionOpenPayload
  | LightningSessionBearerPayload
  | LightningSessionTopUpPayload
  | LightningSessionClosePayload;

export interface ParsedPaymentAuthenticateHeader {
  id: string;
  realm: string;
  method: MppxPaymentMethod;
  intent: MppxIntent;
  request: string;
  expires?: string | undefined;
}

export interface LightningInvoicePaymentResult {
  paymentHash: string;
  preimage: string;
  paymentId?: string | undefined;
  amountPaidSats?: number | undefined;
}

export interface CreateLightningInvoiceOptions {
  description?: string | undefined;
  amountSats?: number | undefined;
}

export interface LightningProviderAdapter {
  provider: string;
  payInvoice(
    invoice: string,
    options?: { amountSats?: number | undefined },
  ): Promise<LightningInvoicePaymentResult>;
  payLightningAddress?(
    lightningAddress: string,
    amountSats: number,
  ): Promise<LightningInvoicePaymentResult>;
  createInvoice(options?: CreateLightningInvoiceOptions): Promise<{
    invoice: string;
    paymentHash?: string | undefined;
    amountSats?: number | undefined;
    expiresAt?: string | undefined;
  }>;
}

export interface ZbdLightningAdapterOptions {
  apiKey: string;
  zbdApiBaseUrl?: string | undefined;
  fetchImpl?: typeof fetch | undefined;
}
