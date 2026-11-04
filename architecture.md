---
id: moderaty-architecture
type: architecture-design
status: draft
title: Moderaty architecture
parent: moderaty-goal
tags: [architecture]
---

<!-- Copyright Andrew Philip Weilbacher; PolyForm Shield License 1.0.0. See LICENSE. -->

## Topology

Moderaty is a SvelteKit 2 / Svelte 5 / TypeScript app. Netlify is the default build adapter; `MODERATY_ADAPTER=node` selects adapter-node for Coolify. Request hooks resolve sessions, while account-entry and app-layout flows enforce current legal consent. Channel routes use the organization-aware `ownedChannel` gate. These module edges are inferred from current imports; no clean application/persistence layer is enforced, and some routes query Drizzle directly or import pipeline actions.

Netlify, Coolify, and local cron drivers call `/api/cron`. `cronWorkload` selects and leases bounded work; `runChannel` coordinates YouTube fetch, decision/scoring, transactional staging and ledger updates, external enforcement, and reconciliation. The related boundaries are [moderation-pipeline](src/lib/server/pipeline/SPEC.md) and [billing-boundary](src/lib/server/billing/SPEC.md); [persistence-boundary](src/lib/server/db/SPEC.md) owns the persistence and migration contract. Stripe owns subscription and lifetime entitlements; Stripe and Mercado Pago both use the organization-scoped prepaid-credit ledger.

## Decisions and invariants

The documented rationale for custom authentication is consent-gated account creation plus organization-scoped access. Current code creates accounts only after required legal consent and scopes channel actions to the active organization; these code paths are not a separate authentication module. Moderation intentions are persisted before YouTube writes, with retry and reconciliation paths intended to repair interrupted work. Non-deadline AI-scoring errors handled by the scoring fallback are routed to human review rather than automatic approval or rejection; `DeadlineExceededError` during scoring escapes before staging so the batch can retry.

## Operations

Owner-confirmed runbook note: the current operating plan accepts Turso Free's 24-hour PITR window, but usable recovery points and a live restore have not been verified.

## Adopted references

Scheduler details live in [cron-workload-fairness](docs/cron-workload-fairness.md); locale and legal-publication policy in [localization-policy](docs/I18N.md); visual design in [moderaty-visual-design](DESIGN.md).
