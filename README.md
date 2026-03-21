# `@axobot/mppx`

Lightning-native Machine Payments Protocol SDK.

`@axobot/mppx` is an Axo-maintained implementation of MPP that keeps the
protocol public and portable while treating Lightning as a first-class
payment method.

It is intended to:

- follow the MPP and HTTP Payment Authentication specifications
- model Lightning `charge` and `session` flows directly
- stay provider-agnostic at the adapter boundary
- ship a ZBD-backed adapter first
- remain useful outside Axo instead of becoming an Axo-only protocol fork

## Why This Package Exists

Most public MPP implementation gravity is currently around Tempo/Spark.
Axo wants a Lightning-native implementation where:

- BOLT11 invoices and preimages are first-class primitives
- session deposits, top-ups, and refunds work on Lightning
- the payment adapter can be swapped later for `lnd`, `cln`, or others
- Axo can use the package without owning a proprietary wire protocol

## Protocol Compatibility

The official Lightning MPP drafts already define:

- `charge` via BOLT11 invoice + preimage proof
- `session` via deposit invoice + preimage bearer token + top-up invoices + refund on close

Primary references:

- [mpp.dev](https://mpp.dev/)
- [wevm/mppx](https://github.com/wevm/mppx)
- [tempoxyz/mpp-specs](https://github.com/tempoxyz/mpp-specs)
- [`draft-lightning-charge-00`](https://raw.githubusercontent.com/tempoxyz/mpp-specs/main/specs/methods/lightning/draft-lightning-charge-00.md)
- [`draft-lightning-session-00`](https://raw.githubusercontent.com/tempoxyz/mpp-specs/main/specs/methods/lightning/draft-lightning-session-00.md)

## Current Package Surface

Current implementation includes:

- Payment-auth challenge parsing
- canonical request and credential encoding helpers
- Lightning `charge` credential builders
- Lightning `session` open / bearer / topUp / close credential builders
- high-level helpers for paying charge challenges and opening/top-up/closing sessions
- BOLT11 payment hash extraction
- first ZBD Lightning adapter
- Axo extension support for `returnLightningAddress`
- refund helper that prefers `returnInvoice` and falls back to `returnLightningAddress`

## Package Shape

The package is currently organized into:

1. `core`
   - Payment-auth parsing and canonical encoding
   - protocol-safe challenge and credential types
2. `lightning`
   - Lightning charge/session helpers
   - invoice/preimage session primitives
3. `adapters`
   - ZBD adapter first
   - future `lnd` / `cln` adapters later

## Axo Extension: `returnLightningAddress`

The current Lightning session draft uses `returnInvoice` as the native refund
field. `@axobot/mppx` also supports `returnLightningAddress` as an Axo
extension:

- if both are present, `returnInvoice` wins
- if only `returnLightningAddress` is present, refund falls back to the adapter
- this keeps the package ergonomic without throwing away spec-native behavior

## Example

```ts
import {
  createZbdLightningAdapter,
  openLightningSession,
  createLightningSessionBearerAuthorization,
} from "@axobot/mppx";

const adapter = createZbdLightningAdapter({
  apiKey: process.env.ZBD_API_KEY!,
});

const session = await openLightningSession({
  challenge,
  adapter,
  returnLightningAddress: "agent@axo.bot",
});

const authorization = createLightningSessionBearerAuthorization({
  challenge: bearerChallenge,
  session,
});
```

## Scripts

```bash
npm run build
npm test
npm run typecheck
```

## Status

Implemented:

- protocol primitives
- Lightning charge/session credential helpers
- first ZBD adapter
- initial high-level client helpers

Still pending:

- richer session manager state model
- fetch/client integration
- server middleware integration
- live validation of zero-amount invoice behavior against ZBD
- non-ZBD Lightning adapters
