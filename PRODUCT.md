---
id: moderaty-goal
type: goal-and-requirements
title: Moderaty product goal
status: draft
---

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Solo creators and small YouTube channel owners whose comment sections have become
a source of dread. They moderate their own channel's comments and want the hate
absorbed by the tool, not by themselves.

> **Unconfirmed:** The audience above and product purpose below are carried
> forward from the existing product charter and have not been independently
> confirmed.

## Product Purpose

Moderaty is comment protection for YouTube creators. It reads every new
top-level comment on a connected channel so the creator never has to, enforces
the creator's rules first, scores what rules miss with OpenAI Moderation, and
routes borderline cases to a human review queue. Success means the creator never
reads another hate comment while their community's norms are enforced
automatically — and every action is auditable.

## Positioning

Unlike engagement tools and agency suites that manage comments for growth,
Moderaty exists to protect the creator: it is designed to enforce the
community's own norms (plain keyword/regex/blocked-user rules) with AI scoring
as a second opinion and route uncertain decisions to review. DB-before-remote
action recording, bounded checkpointed cron runs, and crash reconciliation are
durability safeguards, not a verified guarantee that no enforcement action can
ever be lost or doubled. Moderaty is source-available under the PolyForm Shield
License 1.0.0, with commercial licensing available (see `COMMERCIAL.md`), and
can be self-hosted with dry-run mode and a full audit log instead of a black box.

Category line: "Comment protection for YouTube creators."

## Operating Context

- A YouTube channel owner connects their channel via Google OAuth
  (`youtube.force-ssl`, offline access); the refresh token is stored
  AES-256-GCM-encrypted.
- A scheduled cron endpoint processes one channel per run, one page of
  ≤100 comments per run, with a persisted checkpoint so bursts drain across
  runs without skipping.
- Day-to-day work happens in four surfaces: dashboard (channel overview),
  rules editor, review queue (one-click approve/reject/delete/ban), audit log.
- Two operating paths are supported: self-hosted single operator (own Netlify +
  Turso deployment) and an official hosted multi-user offering.

## Capabilities and Constraints

- Rule types: keyword, regex (native `RegExp`; a 256-character limit plus
  syntax guards and `recheck` reject unsafe or unproven patterns before
  matching), blocked-user; actions: hold, reject, delete, ban.
- AI scoring: OpenAI Moderation `omni-moderation-latest`; score = max of the
  thirteen toxicity categories. **Desired behavior (not fully shipped):**
  ≥0.95 auto-ban, 0.76–0.94 auto-reject, 0.51–0.75 human queue, ≤0.50
  approved; scoring failures go to the human queue, never auto-approve or
  auto-reject. **Current behavior:** ≥0.95 bans, 0.76–0.94 deletes,
  0.51–0.75 queues, and ≤0.50 approves. Non-deadline AI-scoring failures
  queue; deadline expiry during scoring aborts the run instead.
- Tone pass — **desired behavior (not fully shipped):** level 1 ("Edge Lord")
  runs the omni pass only; level 2 ("Edge lord + Ackchyually…") also runs the
  tone pass. The configured OpenAI tone model (default `gpt-6-luna`) scores
  demeaning/condescending/sarcastic tone with the video's title and description
  as context. When tone is the stronger signal, scores below 0.51 approve;
  0.51–0.75 queue for human review; ≥0.76 hold for human review.
  **Current behavior:** tone is enabled at level ≥2 or when either
  `protectLgbtqia` or `protectWomen` is enabled, so an enabled protection flag
  can trigger tone below level 2. Tone outcomes are approval, queue, or hold;
  tone never deletes or bans, even at ≥0.95. The stronger signal decides; the
  tone call is skipped when omni already rejects. The dashboard shows each
  channel's level slider and completed-ban count ("X told to touch grass").
- Enforcement durability: every moderation intent is recorded locally before
  any YouTube write and confirmed after; `DRY_RUN=true` records preview audit
  rows without staging comments or sending YouTube writes.
- Comment text is never stored longer than 500 characters. Top-level comments
  only; reply moderation is an explicit non-goal.
- Stack: SvelteKit 2 + Svelte 5 + TypeScript; adapter-netlify is the default,
  and adapter-node is selected at build time for Coolify. Drizzle ORM over
  libSQL (`file:local.db` dev, Turso prod). Approved dependencies only; no auth
  libraries, no googleapis/OpenAI SDKs, no CSS frameworks, no zod.
- Non-goals: multi-platform moderation, live chat, real-time
  scanning, LLM-as-judge for borderline comments.

## Brand Commitments

- Name: **Moderaty** (the string `yt-mod` must not appear in `src/`).
- Tagline (unchanged, binding): "Never read another hate comment."
- Hero-copy direction: "Never read another hate comment." / "Comment
  protection for YouTube creators — your community's norms, enforced while you
  sleep." The first line is shipped as the homepage H1; the second is product
  positioning, not the current H2 or subcopy.
- Contrast line (bottom of funnel; proposed and not cleared as public copy):
  "Every other comment tool wants to grow your channel. Moderaty wants to
  protect you."
- Disengagement-fighter line (top of funnel): "'Just don't read the comments'
  is not a strategy. It's a surrender."
- Voice: protective, plain-English, on the creator's side.
- License: PolyForm Shield License 1.0.0 with commercial licensing option
  (see `COMMERCIAL.md`); copyright
  Andrew Philip Weilbacher; license header required on new source/doc files.

## Evidence on Hand

- Working implementation: OAuth connect flow, cron pipeline, rules/queue/log
  pages (`src/routes/`, `src/lib/server/`).
- Executable spec: `EXECUTION_PLAN_YouTube_Comment_Moderator.md` (v3),
  including the 13 invariants (I1–I13) that remain binding.
- No testimonials, customer references, benchmarks, or press exist — future
  work must not fabricate them.

## Product Principles

1. Protect the creator, not the metric — every decision favors absorbing harm
   over growing engagement.
2. The user's rules are law; AI is the second opinion, and doubt always goes
   to a human.
3. Never lose or double an enforcement action — durability before speed.
4. Fail loudly: errors surface to logs and users; no silent fallbacks.
5. Preview before commit: dry-run and audit trails make automation trustworthy.
