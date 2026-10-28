---
id: billing-boundary
type: module-design
status: draft
title: Billing and entitlements
parent: moderaty-architecture
tags: [billing, payments]
depends-on: [persistence-boundary]
---

<!-- Copyright Andrew Philip Weilbacher; PolyForm Shield License 1.0.0. See LICENSE. -->

## Responsibility

Billing owns organization-scoped entitlements and credit-ledger mutations. Stripe handles hosted subscriptions and lifetime entitlements and also supports prepaid-credit purchases. Stripe and Mercado Pago both grant and reverse prepaid credits through the shared ledger; Mercado Pago does not implement subscription or lifetime entitlements. Provider procedure details remain with their operational docs.

## Boundary

Webhook routes verify provider signatures before handing validated events to server-side handlers. Stripe event claims and provider payment identifiers, together with unique organization-scoped ledger references, make fulfillment and reversal retries idempotent. Provider credentials and SDK clients remain server-side and are never exposed to clients. Partial refunds do not proportionally reverse credits: Stripe recognizes them without a proportional ledger debit, while Mercado Pago partial-refund approvals are rejected for manual review.
