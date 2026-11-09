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

## Reply recheck

`replySweep.ts` (`runReplySweep`) is a second bounded unit under the cron claim that the live run already holds. The tick runs it after `runChannel`, and it never runs for dry-run, preview or history work. Each tick reads one thread page (`fetchNewComments` with `includeReplies`, `maxPages: 1`), keeps replies published at or after `moderate_replies_since` that are not stored yet, and processes at most 100 of them. Reply lookups are capped at 10 per tick and 5 pages per thread. Staging goes through `decideAndStage`, which takes an optional `ctx.adjust(decisions)` hook; the recheck passes `capReplyDeletes`, so at most 10 reply deletes run per tick and no more than the day's remaining quota allows; the rest are stored as rejects. Enforcement goes through `runEnforcement`. A refused reply write parks its row as `failed` and does not block the live cursor (`enforcement.ts`). Progress is a compare-and-set on the channel checkpoint columns, which throws if the setting, the history marker, the page token or the lease has changed. The gates, the quota ceiling, the checkpoint states and the parked behaviour are in [reply moderation](../../../../docs/reply-moderation.md).
