# Engineering Contract — `@axobot/mppx`

> **Status**: Normative. All implementation work in this repository must conform to every rule in this document.
> **Scope**: Lightning-native Machine Payments Protocol primitives, credential encoding, session lifecycle helpers, and provider adapters. The first adapter target is ZBD. The package is protocol-compatible, not Axo-proprietary.

---

## 1. Protocol Boundary

### 1.1 Protocol Identity

This package implements the Machine Payments Protocol and the HTTP Payment
Authentication scheme. It MUST NOT invent an Axo-only payment protocol.

The package MAY provide Axo-maintained adapters, defaults, and helpers, but the
wire model MUST remain aligned with the public MPP specifications.

### 1.2 Lightning Method

Lightning support MUST follow the official Lightning MPP method drafts:

- `charge` uses a BOLT11 invoice and a payment preimage credential
- `session` uses a deposit invoice, bearer preimage, top-up invoices, and a return invoice

Implementations MUST treat invoices and preimages as first-class protocol
objects, not as backward-compatibility shims.

### 1.2.1 Axo Extension: `returnLightningAddress`

The official Lightning session draft uses `returnInvoice` as the native refund
destination. `@axobot/mppx` MAY additionally support `returnLightningAddress`
as an Axo extension field on session open credentials.

When both are present, implementations MUST prefer `returnInvoice`.
When only `returnLightningAddress` is present, implementations MAY use it as a
fallback refund target via adapter-specific payment flows.

### 1.3 Adapter Boundary

The package core MUST remain provider-agnostic. Lightning provider-specific
behavior belongs behind adapter interfaces. The first adapter MAY target ZBD,
but core session and credential logic MUST NOT depend on ZBD-specific response
shapes.

---

## 2. Amount Units

### 2.1 Boundary Outputs

All public API surfaces of this package MUST express Lightning amounts in
**satoshis (sat)**, not millisatoshis.

### 2.2 ZBD Conversion

When talking to ZBD APIs, the adapter MAY convert to millisatoshis internally,
but all exported results, challenge helpers, and error metadata MUST remain in
satoshis.

---

## 3. Release Policy

### 3.1 Versioning

This package follows **Semantic Versioning 2.0.0**.

### 3.2 Publishing

Releases are published to the public npm registry under the `@axobot` scope.
Publishing uses npm OIDC Trusted Publishing via GitHub Actions. Manual local
publishes are forbidden.

### 3.3 Changelog

`semantic-release` generates `CHANGELOG.md` automatically. Manual changelog
edits are forbidden.

---

## 4. Compatibility Policy

### 4.1 HTTP Payment Authentication

The package MUST model Payment-auth challenges and credentials in a way that is
compatible with the IETF/payment-auth drafts and the official MPP specs.

### 4.2 Lightning Credentials

Charge and session credentials MUST preserve the challenge echo and the
Lightning-specific payload fields exactly. `preimage`, `topUpPreimage`,
`returnInvoice`, `returnLightningAddress`, and `sessionId` are public contract
fields and MUST NOT be renamed without a major version bump.

### 4.3 Node.js Runtime

Minimum supported runtime: **Node.js 22 LTS**.

---

*Last updated: 2026-03-20. Maintained by the Axo team.*
