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

Billing owns organization-scoped entitlements and credit-ledger mutations. Stripe handles hosted subscriptions, lifetime entitlements and prepaid-credit purchases, and grants and reverses prepaid credits through the shared ledger. Provider procedure details remain with its operational docs.

## Boundary

Webhook routes verify provider signatures before handing validated events to server-side handlers. Stripe event claims and provider payment identifiers, together with unique organization-scoped ledger references, make fulfillment and reversal retries idempotent. Provider credentials and SDK clients remain server-side and are never exposed to clients. Partial refunds do not proportionally reverse credits: Stripe recognizes them without a proportional ledger debit.
