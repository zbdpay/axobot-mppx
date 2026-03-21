import test from "node:test";
import assert from "node:assert/strict";

import {
  closeLightningSession,
  createLightningChargeCredential,
  createLightningSessionBearerAuthorization,
  createLightningSessionBearerCredential,
  createLightningSessionCloseCredential,
  createLightningSessionOpenCredential,
  createLightningSessionTopUpCredential,
  createZbdLightningAdapter,
  openLightningSession,
  payLightningChargeChallenge,
  decodePaymentCredential,
  decodePaymentRequest,
  encodeLightningChargeCredential,
  encodeLightningSessionCredential,
  encodePaymentRequest,
  parsePaymentAuthenticateHeader,
  refundLightningSessionBalance,
  topUpLightningSession,
} from "../dist/index.js";

const chargeRequest = encodePaymentRequest({
  amount: "100",
  currency: "sat",
  description: "charge access",
  methodDetails: {
    invoice: "lnbc1exampleinvoice",
    paymentHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    network: "mainnet",
  },
});

const sessionRequest = encodePaymentRequest({
  amount: "5",
  currency: "sat",
  unitType: "token",
  methodDetails: {
    depositInvoice: "lnbc1depositinvoice",
    paymentHash: "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    depositAmount: "100",
    idleTimeout: "300",
  },
});

const chargeChallenge = {
  id: "charge-1",
  realm: "api.example.com",
  method: "lightning",
  intent: "charge",
  request: chargeRequest,
  expires: "2026-03-20T12:00:00Z",
};

const sessionChallenge = {
  id: "session-1",
  realm: "api.example.com",
  method: "lightning",
  intent: "session",
  request: sessionRequest,
  expires: "2026-03-20T12:00:00Z",
};

test("parses Payment authenticate header", () => {
  const parsed = parsePaymentAuthenticateHeader(
    `Payment id="session-1", realm="api.example.com", method="lightning", intent="session", request="${sessionRequest}", expires="2026-03-20T12:00:00Z"`,
  );

  assert.deepEqual(parsed, sessionChallenge);
});

test("encodes and decodes charge credential with preimage", () => {
  const encoded = encodeLightningChargeCredential({
    challenge: chargeChallenge,
    preimage: "aa".repeat(32),
    source: "did:key:z6Mkg123",
  });

  const decoded = decodePaymentCredential(encoded);
  assert.deepEqual(decoded, createLightningChargeCredential({
    challenge: chargeChallenge,
    preimage: "aa".repeat(32),
    source: "did:key:z6Mkg123",
  }));
});

test("encodes session open, bearer, top-up, and close credentials", () => {
  const openEncoded = encodeLightningSessionCredential(
    createLightningSessionOpenCredential({
      challenge: sessionChallenge,
      preimage: "11".repeat(32),
      returnInvoice: "lnbc1returninvoice",
    }),
  );
  const bearerEncoded = encodeLightningSessionCredential(
    createLightningSessionBearerCredential({
      challenge: sessionChallenge,
      sessionId: "session-hash-1",
      preimage: "11".repeat(32),
    }),
  );
  const topUpEncoded = encodeLightningSessionCredential(
    createLightningSessionTopUpCredential({
      challenge: sessionChallenge,
      sessionId: "session-hash-1",
      topUpPreimage: "22".repeat(32),
    }),
  );
  const closeEncoded = encodeLightningSessionCredential(
    createLightningSessionCloseCredential({
      challenge: sessionChallenge,
      sessionId: "session-hash-1",
      preimage: "11".repeat(32),
    }),
  );

  assert.equal(decodePaymentCredential(openEncoded).payload.action, "open");
  assert.equal(decodePaymentCredential(bearerEncoded).payload.action, "bearer");
  assert.equal(decodePaymentCredential(topUpEncoded).payload.action, "topUp");
  assert.equal(decodePaymentCredential(closeEncoded).payload.action, "close");
});

test("decodes encoded payment request payloads", () => {
  const decoded = decodePaymentRequest(sessionRequest);
  assert.equal(decoded.amount, "5");
  assert.equal(decoded.currency, "sat");
  assert.deepEqual(decoded.methodDetails, {
    depositInvoice: "lnbc1depositinvoice",
    paymentHash: "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    depositAmount: "100",
    idleTimeout: "300",
  });
});

test("zbd adapter pays invoices and returns preimage data", async () => {
  const calls = [];
  const adapter = createZbdLightningAdapter({
    apiKey: "test-key",
    zbdApiBaseUrl: "https://api.example.test",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          data: {
            id: "pay_123",
            preimage: "33".repeat(32),
            paymentHash: "44".repeat(32),
            amount_sats: 21,
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    },
  });

  const result = await adapter.payInvoice("lnbc1invoice");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.example.test/v0/payments");
  assert.equal(result.paymentId, "pay_123");
  assert.equal(result.preimage, "33".repeat(32));
  assert.equal(result.paymentHash, "44".repeat(32));
  assert.equal(result.amountPaidSats, 21);
});

test("zbd adapter creates invoice with zero-amount-compatible request shape", async () => {
  const calls = [];
  const adapter = createZbdLightningAdapter({
    apiKey: "test-key",
    zbdApiBaseUrl: "https://api.example.test",
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return new Response(
        JSON.stringify({
          data: {
            id: "charge_123",
            paymentHash: "55".repeat(32),
            invoice: {
              request: "lnbc1returninvoice",
            },
            expiresAt: "2026-03-20T13:00:00Z",
          },
        }),
        {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        },
      );
    },
  });

  const result = await adapter.createInvoice({
    amountSats: 0,
    description: "return invoice",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.example.test/v0/charges");
  const payload = JSON.parse(calls[0].init.body);
  assert.equal(payload.amount, 0);
  assert.equal(result.invoice, "lnbc1returninvoice");
  assert.equal(result.paymentHash, "55".repeat(32));
  assert.equal(result.amountSats, 0);
  assert.equal(result.expiresAt, "2026-03-20T13:00:00Z");
});

test("pays a charge challenge through the adapter and returns authorization", async () => {
  const adapter = {
    provider: "fake",
    async payInvoice() {
      return {
        paymentHash: "66".repeat(32),
        preimage: "77".repeat(32),
        amountPaidSats: 100,
      };
    },
    async createInvoice() {
      throw new Error("not used");
    },
  };

  const result = await payLightningChargeChallenge({
    challenge: chargeChallenge,
    adapter,
  });

  const decoded = decodePaymentCredential(result.authorization);
  assert.equal(decoded.payload.preimage, "77".repeat(32));
  assert.equal(result.amountSats, 100);
});

test("opens a Lightning session and derives bearer, top-up, and close authorizations", async () => {
  let createInvoiceCalls = 0;
  const adapter = {
    provider: "fake",
    async payInvoice(invoice) {
      if (invoice === "lnbc1depositinvoice") {
        return {
          paymentHash: "88".repeat(32),
          preimage: "99".repeat(32),
          amountPaidSats: 100,
        };
      }

      return {
        paymentHash: "aa".repeat(32),
        preimage: "bb".repeat(32),
        amountPaidSats: 50,
      };
    },
    async createInvoice() {
      createInvoiceCalls += 1;
      return {
        invoice: "lnbc1returninvoice",
        paymentHash: "cc".repeat(32),
        amountSats: 0,
      };
    },
  };

  const session = await openLightningSession({
    challenge: sessionChallenge,
    adapter,
  });

  assert.equal(createInvoiceCalls, 1);
  assert.equal(session.sessionId, "abcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd");
  assert.equal(session.returnInvoice, "lnbc1returninvoice");

  const bearer = decodePaymentCredential(
    createLightningSessionBearerAuthorization({
      challenge: sessionChallenge,
      session,
    }),
  );
  assert.equal(bearer.payload.action, "bearer");
  assert.equal(bearer.payload.sessionId, session.sessionId);

  const topUp = await topUpLightningSession({
    challenge: sessionChallenge,
    session,
    adapter,
  });
  assert.equal(decodePaymentCredential(topUp.authorization).payload.action, "topUp");

  const close = decodePaymentCredential(
    closeLightningSession({
      challenge: sessionChallenge,
      session,
    }),
  );
  assert.equal(close.payload.action, "close");
});

test("session open can use returnLightningAddress without a returnInvoice", async () => {
  const adapter = {
    provider: "fake",
    async payInvoice() {
      return {
        paymentHash: "dd".repeat(32),
        preimage: "ee".repeat(32),
      };
    },
    async createInvoice() {
      throw new Error("not used");
    },
  };

  const session = await openLightningSession({
    challenge: sessionChallenge,
    adapter,
    returnLightningAddress: "agent@axo.bot",
  });

  const decoded = decodePaymentCredential(session.authorization);
  assert.equal(decoded.payload.returnInvoice, undefined);
  assert.equal(decoded.payload.returnLightningAddress, "agent@axo.bot");
});

test("refund helper prefers returnInvoice and passes amountSats through", async () => {
  const calls = [];
  const adapter = {
    provider: "fake",
    async payInvoice(invoice, options) {
      calls.push({ invoice, options });
      return {
        paymentHash: "ff".repeat(32),
        preimage: "11".repeat(32),
      };
    },
    async createInvoice() {
      throw new Error("not used");
    },
  };

  await refundLightningSessionBalance({
    adapter,
    amountSats: 123,
    returnInvoice: "lnbc1refundinvoice",
    returnLightningAddress: "agent@axo.bot",
  });

  assert.deepEqual(calls, [
    {
      invoice: "lnbc1refundinvoice",
      options: { amountSats: 123 },
    },
  ]);
});

test("refund helper falls back to Lightning Address when no returnInvoice is present", async () => {
  const calls = [];
  const adapter = {
    provider: "fake",
    async payInvoice() {
      throw new Error("not used");
    },
    async payLightningAddress(lightningAddress, amountSats) {
      calls.push({ lightningAddress, amountSats });
      return {
        paymentHash: "22".repeat(32),
        preimage: "33".repeat(32),
        amountPaidSats: amountSats,
      };
    },
    async createInvoice() {
      throw new Error("not used");
    },
  };

  const result = await refundLightningSessionBalance({
    adapter,
    amountSats: 456,
    returnLightningAddress: "agent@axo.bot",
  });

  assert.equal(result.amountPaidSats, 456);
  assert.deepEqual(calls, [
    {
      lightningAddress: "agent@axo.bot",
      amountSats: 456,
    },
  ]);
});
