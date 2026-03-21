import { extractPaymentHashFromBolt11 } from "./bolt11.js";
import type {
  CreateLightningInvoiceOptions,
  LightningInvoicePaymentResult,
  LightningProviderAdapter,
  ZbdLightningAdapterOptions,
} from "./types.js";

const DEFAULT_ZBD_API_BASE_URL = "https://api.zbdpay.com";

function readObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object") {
    return value as Record<string, unknown>;
  }
  return {};
}

function getString(data: Record<string, unknown>, paths: string[][]): string | undefined {
  for (const path of paths) {
    let current: unknown = data;
    for (const key of path) {
      if (!current || typeof current !== "object") {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[key];
    }
    if (typeof current === "string" && current.length > 0) {
      return current;
    }
  }
  return undefined;
}

function getNumber(data: Record<string, unknown>, paths: string[][]): number | undefined {
  for (const path of paths) {
    let current: unknown = data;
    for (const key of path) {
      if (!current || typeof current !== "object") {
        current = undefined;
        break;
      }
      current = (current as Record<string, unknown>)[key];
    }
    if (typeof current === "number" && Number.isFinite(current)) {
      return current;
    }
  }
  return undefined;
}

async function parseResponseJson(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {};
  }

  try {
    return readObject(await response.json());
  } catch {
    return {};
  }
}

export function createZbdLightningAdapter(
  options: ZbdLightningAdapterOptions,
): LightningProviderAdapter {
  const fetchImpl = options.fetchImpl ?? fetch;
  const apiBaseUrl = options.zbdApiBaseUrl ?? DEFAULT_ZBD_API_BASE_URL;

  return {
    provider: "zbd",

    async payInvoice(
      invoice: string,
      payOptions?: { amountSats?: number | undefined },
    ): Promise<LightningInvoicePaymentResult> {
      const payload: Record<string, unknown> = {
        invoice,
      };
      if (typeof payOptions?.amountSats === "number") {
        payload.amount = payOptions.amountSats;
      }

      const response = await fetchImpl(`${apiBaseUrl}/v0/payments`, {
        method: "POST",
        headers: {
          apikey: options.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = await parseResponseJson(response);
      if (!response.ok) {
        throw new Error(`ZBD invoice payment failed: ${response.status}`);
      }

      const nested = readObject(body.data);
      const paymentHash =
        getString(body, [["paymentHash"], ["payment_hash"], ["hash"]]) ??
        getString(nested, [["paymentHash"], ["payment_hash"], ["hash"]]) ??
        extractPaymentHashFromBolt11(invoice);
      const preimage =
        getString(body, [["preimage"]]) ?? getString(nested, [["preimage"]]);

      if (!paymentHash || !preimage) {
        throw new Error("ZBD payment response missing paymentHash or preimage");
      }

      return {
        paymentHash,
        preimage,
        paymentId:
          getString(body, [["id"], ["payment_id"]]) ??
          getString(nested, [["id"], ["payment_id"]]),
        amountPaidSats:
          getNumber(body, [["amount_sats"], ["amountSats"]]) ??
          getNumber(nested, [["amount_sats"], ["amountSats"]]) ??
          payOptions?.amountSats,
      };
    },

    async payLightningAddress(
      lightningAddress: string,
      amountSats: number,
    ): Promise<LightningInvoicePaymentResult> {
      const response = await fetchImpl(`${apiBaseUrl}/v0/ln-address/send-payment`, {
        method: "POST",
        headers: {
          apikey: options.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          lnAddress: lightningAddress,
          amount: String(amountSats * 1000),
          comment: "MPP session refund",
        }),
      });

      const body = await parseResponseJson(response);
      if (!response.ok) {
        throw new Error(`ZBD Lightning Address payment failed: ${response.status}`);
      }

      const nested = readObject(body.data);
      const paymentHash =
        getString(body, [["paymentHash"], ["payment_hash"], ["hash"]]) ??
        getString(nested, [["paymentHash"], ["payment_hash"], ["hash"]]);
      const preimage =
        getString(body, [["preimage"]]) ?? getString(nested, [["preimage"]]);

      if (!paymentHash || !preimage) {
        throw new Error("ZBD Lightning Address payment response missing paymentHash or preimage");
      }

      return {
        paymentHash,
        preimage,
        paymentId:
          getString(body, [["id"], ["payment_id"]]) ??
          getString(nested, [["id"], ["payment_id"]]),
        amountPaidSats:
          getNumber(body, [["amount_sats"], ["amountSats"]]) ??
          getNumber(nested, [["amount_sats"], ["amountSats"]]) ??
          amountSats,
      };
    },

    async createInvoice(optionsArg?: CreateLightningInvoiceOptions): Promise<{
      invoice: string;
      paymentHash?: string | undefined;
      amountSats?: number | undefined;
      expiresAt?: string | undefined;
    }> {
      const amountMsat =
        typeof optionsArg?.amountSats === "number"
          ? optionsArg.amountSats * 1000
          : 0;

      const response = await fetchImpl(`${apiBaseUrl}/v0/charges`, {
        method: "POST",
        headers: {
          apikey: options.apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          amount: amountMsat,
          description: optionsArg?.description ?? "MPP session return invoice",
        }),
      });

      const body = await parseResponseJson(response);
      if (!response.ok) {
        throw new Error(`ZBD invoice creation failed: ${response.status}`);
      }

      const nested = readObject(body.data);
      const invoice =
        getString(body, [["invoice"], ["invoiceRequest"], ["bolt11"]]) ??
        getString(body, [["data", "invoice"], ["data", "invoiceRequest"], ["data", "bolt11"]]) ??
        getString(readObject(body.invoice), [["request"], ["paymentRequest"]]) ??
        getString(readObject(nested.invoice), [["request"], ["paymentRequest"]]);

      if (!invoice) {
        throw new Error("ZBD invoice creation response missing invoice");
      }

      return {
        invoice,
        paymentHash:
          getString(body, [["paymentHash"], ["payment_hash"]]) ??
          getString(nested, [["paymentHash"], ["payment_hash"]]) ??
          extractPaymentHashFromBolt11(invoice) ??
          undefined,
        amountSats: typeof optionsArg?.amountSats === "number" ? optionsArg.amountSats : 0,
        expiresAt:
          getString(body, [["expiresAt"], ["expires_at"]]) ??
          getString(nested, [["expiresAt"], ["expires_at"]]),
      };
    },
  };
}
