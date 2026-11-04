---
id: moderation-pipeline
type: module-design
status: draft
title: Moderation pipeline
parent: moderaty-architecture
tags: [pipeline, moderation]
depends-on: [billing-boundary, persistence-boundary]
---

<!-- Copyright Andrew Philip Weilbacher; PolyForm Shield License 1.0.0. See LICENSE. -->

## Responsibility

`runChannel` orchestrates a channel run from YouTube fetch through decision/scoring, transactional staging with credit-ledger updates, and external enforcement with reconciliation. These concerns are separate implementation modules, but they are coordinated by the pipeline. Non-deadline AI-scoring errors handled by the scoring fallback route comments to human review; dry-run records audit previews without staging comments or invoking YouTube enforcement.

## Boundary

User-facing callers must authenticate and establish active-organization ownership before invoking channel work; route actions use `ownedChannel` for this check. Cron runs work selected and leased internally, without an end-user session. A database intent is persisted before a YouTube write, and retries/reconciliation are idempotent. These module edges are inferred from current imports, not enforced: some routes query Drizzle directly or import pipeline actions, and pipeline code is not itself an authorization layer.
