import { decodeBase64Url, encodeBase64Url } from "./base64url.js";
import { canonicalizeJson } from "./json.js";
import type {
  ParsedPaymentAuthenticateHeader,
  PaymentChallengeContext,
  PaymentCredential,
  PaymentRequestEnvelope,
} from "./types.js";

function stripQuotes(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parsePaymentAuthenticateHeader(header: string): ParsedPaymentAuthenticateHeader {
  const trimmed = header.trim();
  if (!trimmed.toLowerCase().startsWith("payment ")) {
    throw new Error("Unsupported authenticate scheme");
  }

  const params = trimmed.slice("Payment ".length);
  const result: Record<string, string> = {};
  for (const part of params.split(",")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = part.slice(0, separatorIndex).trim();
    const value = stripQuotes(part.slice(separatorIndex + 1));
    result[key] = value;
  }

  if (
    typeof result.id !== "string" ||
    typeof result.realm !== "string" ||
    typeof result.method !== "string" ||
    typeof result.intent !== "string" ||
    typeof result.request !== "string"
  ) {
    throw new Error("Malformed Payment authenticate header");
  }

  if (result.method !== "lightning") {
    throw new Error(`Unsupported payment method: ${result.method}`);
  }

  if (result.intent !== "charge" && result.intent !== "session") {
    throw new Error(`Unsupported payment intent: ${result.intent}`);
  }

  return {
    id: result.id,
    realm: result.realm,
    method: result.method,
    intent: result.intent,
    request: result.request,
    expires: result.expires,
  };
}

export function decodePaymentRequest<TRequest extends PaymentRequestEnvelope>(
  request: string,
): TRequest {
  return JSON.parse(decodeBase64Url(request)) as TRequest;
}

export function encodePaymentRequest(request: PaymentRequestEnvelope): string {
  return encodeBase64Url(canonicalizeJson(request));
}

export function encodePaymentCredential<TPayload extends object>(
  credential: PaymentCredential<TPayload>,
): string {
  return encodeBase64Url(canonicalizeJson(credential));
}

export function decodePaymentCredential<TPayload extends object>(
  encoded: string,
): PaymentCredential<TPayload> {
  return JSON.parse(decodeBase64Url(encoded)) as PaymentCredential<TPayload>;
}

export function normalizeChallengeContext(
  context: PaymentChallengeContext,
): PaymentChallengeContext {
  return {
    id: context.id,
    realm: context.realm,
    method: context.method,
    intent: context.intent,
    request: context.request,
    expires: context.expires,
  };
}
