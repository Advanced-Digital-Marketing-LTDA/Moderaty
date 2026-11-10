---
id: persistence-boundary
type: module-design
status: draft
title: Persistence and migrations
parent: moderaty-architecture
tags: [database, migrations]
---

<!-- Copyright Andrew Philip Weilbacher; PolyForm Shield License 1.0.0. See LICENSE. -->

## Responsibility

This module centralizes the Drizzle/libSQL client and schema in `src/lib/server/db/`; `drizzle.config.ts` generates migrations under `drizzle/`. Schema changes are append-only: add a new migration and never edit a migration already applied in any environment.

## Boundary

This is a shared persistence contract, not a repository layer. Routes and domain modules import the Drizzle client/schema directly, so query ownership is not exclusively encapsulated here and a clean persistence boundary is not enforced.

## Reply moderation columns and quota table

Migration `0075_reply_moderation_columns.sql` adds nullable columns and rewrites no existing rows:

- `comments.parent_id` (text): the reply's top-level comment id. NULL for top-level comments. No index.
- `channels.moderate_replies_since` (text, ISO): NULL means reply moderation is off.
- `channels.reply_sweep_boundary`, `channels.reply_sweep_page_token` and `channels.reply_sweep_last_at` (text): the reply recheck checkpoint. `reply_sweep_last_at` is the pass start while a pass is in flight and the completion time when idle.
- `channels.reply_sweep_shortfall` (integer): replies the last recheck could not cover.

Migration `0076_youtube_quota_usage.sql` creates `youtube_quota_usage`: `day` (text, primary key, one row per Pacific day), `units` (integer, default 0) and `exhausted_at` (text, NULL unless a quota refusal stamped the day). It is a global table with no channel key. The recheck and the channel page read it, so both migrations must be applied before this code is deployed.

Drift note, not resolved here: `schema.ts` does not declare `channel_allowed_handles.resolved_channel_id`. Migration 0071 added it, 0072 dropped it and 0073 added it back, so the database has the column, and the 0073, 0074, 0075 and 0076 snapshots include it. `drizzle-kit generate` therefore proposes dropping it. That drop is a human decision. Neither 0075 nor 0076 contains a DROP; both were written by hand, and their snapshots keep the column.
