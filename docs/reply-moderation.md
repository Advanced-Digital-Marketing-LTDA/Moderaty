# Reply moderation

Reply moderation checks replies to top-level comments on channels whose owner turns it on. It is off by default and is set per channel on the channel's Overview tab. This document covers the design, the limits, the YouTube quota model, failure handling, the operator runbook, and the API facts the design depends on.

Code: `src/lib/server/pipeline/replySweep.ts` (the recheck pass), `src/lib/server/quota.ts` (the quota meter and ceiling), `src/lib/server/youtube.ts` (reply fetch and the `ytFetch` meter), `src/routes/api/cron/+server.ts` (the tick), `src/routes/(app)/channels/[id]/+page.server.ts` (the owner setting). The recheck is named "sweep" in code identifiers only.

## Purpose and scope

Moderaty checks a reply when all of these hold:

- the reply was published at or after the instant the owner turned reply moderation on (`channels.moderate_replies_since`);
- its top-level comment was published within the last 72 hours (`REPLY_LOOKBACK_MS`);
- the channel is active, has no history scan running, belongs to a paid org (or is self-hosted), and the deployment is not in `DRY_RUN=true`;
- the author is not the channel owner. Owner replies are skipped and counted (`ownRepliesSkipped`), never moderated.

Not covered:

- replies published before the owner turned the setting on;
- replies on threads whose top-level comment is older than 72 hours;
- live chat;
- YouTube's Held queue;
- analyze-history scans, dry-run previews and the feedback digest. These read top-level comments only. The `fetchNewComments` calls they make never pass `includeReplies`, and `pendingStoredFeedback` excludes rows with `comments.parent_id` set (see [feedback-clustering](feedback-clustering.md)).

Replies go through the same rules, protected handles, AI scoring, review queue and enforcement as top-level comments. The only reply-specific additions are the `parent_id` column, the recheck pass, the per-tick caps, the delete budget and the parked-action handling below.

## How it works

### The tick

A recheck runs inside a cron tick for one claimed channel, after the live run. See [Cron wiring](#cron-wiring).

Gates, in order (`refusedBy`, then the quota gate). A refused gate makes no YouTube call and no write:

1. `historyBoundary` is set: `history-running`.
2. Channel inactive: `inactive`.
3. Org unpaid: `unpaid`.
4. `DRY_RUN=true`: `dry-run`.
5. Under 8 seconds left before the deadline (`REPLY_SWEEP_MIN_REMAINING_MS`): `no-time`.
6. Quota gate (see [Quota model](#quota-model)): `ceiling-not-set`, `kill-switch`, `ceiling-invalid`, `quota-exhausted-today`, `quota-ceiling-reached`.

When no pass is in flight, a tick is idle unless `now >= reply_sweep_last_at + 1 h` (`REPLY_SWEEP_INTERVAL_MS`). An idle tick makes no call and no write. Enabling the setting sets `reply_sweep_last_at` to the enable instant, so the first pass runs at least one hour later.

### A pass

- **Start.** The pass boundary is `max(now − 72 h, moderate_replies_since)`. The start is persisted (boundary, token NULL, `reply_sweep_last_at = now`, shortfall 0) before the first YouTube call.
- **Tick.** One `commentThreads.list` page through `fetchNewComments(..., { maxPages: 1, includeReplies: true, pageToken })`. Replies with a `parentId`, published at or after `moderate_replies_since`, first occurrence per id, and not already stored are the candidates. Top-level comments drop out here.
- **Caps per tick.** At most 100 fresh replies are processed (`REPLY_FRESH_CAP_PER_TICK`). Reply lookups (`comments.list` with `parentId`, made only when `totalReplyCount` says the embedded replies are short) are limited to 10 calls per tick (`MAX_REPLY_LOOKUPS_PER_TICK`) and 5 pages per thread (`MAX_REPLY_PAGES_PER_THREAD`). Replies the tick cannot cover are counted as shortfall.
- **Stage and enforce.** Candidates go through `decideAndStage` (exported from `pipeline/run.ts`) with the `adjust` hook set to a closure built per tick over the day's remaining allowance, which applies `capReplyDeletes` (see `replySweep.ts`), then `runEnforcement`. Enforcement errors are caught, logged and reported; the action rows stay outstanding for a later run.
- **Checkpoint.** See [Checkpoint](#checkpoint).
- **Access token.** Requested lazily through `getAccessToken`, only once the tick is going to call YouTube or write.
- **Stale pass.** A pass in flight whose start (`reply_sweep_last_at`) is more than 6 hours old restarts from the lookback (`REPLY_PASS_TTL_MS`). This sheds a stale page token. A pass with a boundary but no recorded start also restarts, with a warning.
- **Sub-deadline.** The tick's fetch, staging and enforcement share `min(deadline, now + 10 s)` (`REPLY_SWEEP_SUB_DEADLINE_MS`). Running out of time returns `partial` with no checkpoint write, so the next tick reads the same page.

Outcomes (`ReplySweepStatus`):

| Status | Meaning | Checkpoint |
| --- | --- | --- |
| `skipped` | A gate or the quota gate refused the tick (`reason` says which). | none |
| `idle` | Not due. | none |
| `held` | More than 100 fresh replies on this page. The tick processed 100; the same page is read again next tick and stored ids are skipped. | none |
| `advanced` | Page done, more pages remain. | boundary kept, token = next page token, `last_at` kept (pass start) |
| `finished` | `reachedCursor` or no next page token. | boundary and token NULL, `last_at` = completion time |
| `abandoned` | A reply was deferred for lack of credits. The pass ends; the next pass starts again from the lookback. | boundary and token NULL, `last_at` = now |
| `partial` | Deadline reached, or the channel was deactivated mid-tick. | none |

### Checkpoint

Columns:

| Column | Meaning |
| --- | --- |
| `channels.moderate_replies_since` | ISO instant the owner turned the setting on. NULL = off. Enable sets it to now; re-saving an enabled setting changes nothing; disable sets it to NULL. Only replies at or after it are moderated. Once it is NULL, no pending reply row is written; those rows stay pending in the review queue for a human decision. |
| `channels.reply_sweep_boundary` | Start of the pass in flight (the lookback cut-off). NULL when no pass is in flight. |
| `channels.reply_sweep_page_token` | YouTube continuation token for the next thread page. NULL at the first page and when idle. |
| `channels.reply_sweep_last_at` | Two meanings. While a pass is in flight it is the pass start, which drives the 6-hour restart. When idle it is the completion time of the last pass, which drives the 1-hour interval. Enabling sets it to the enable instant. |
| `channels.reply_sweep_shortfall` | Replies the pass could not cover. While a pass is in flight, the running total for that pass; after completion, the final total. NULL or 0 when never run or off. The owner sees it on the Overview status line. |
| `comments.parent_id` | A reply's top-level comment id. NULL for top-level comments. No index. |

Every checkpoint write is a transaction. It asserts the channel is still active, then updates only if `moderate_replies_since`, `reply_sweep_boundary`, `reply_sweep_page_token` and `lease_expires_at` still hold the values this pass read, and `history_boundary IS NULL`. Zero rows updated throws `reply recheck checkpoint changed for channel <id> — aborting`. This covers a re-toggle, a history scan that starts mid-pass, deactivation and a lost lease. The NULL-safe comparison is `sameOrNull`.

### Cron wiring

`runClaimedChannel` runs, in order: the live run, the reply recheck, the dry-run drain, the digest.

- The recheck takes no claim or lease of its own. It runs under the claim and lease the live run already holds, and shares the tick deadline.
- It runs whenever the live result is not skipped, not dry, not partial, not out of credits and not unpaid, and the setting is on. The channel row is re-read after the live run. The sweep itself reports history-running and no-time (under 8 seconds left) as skipped reasons, and no access token is fetched for a skipped tick.
- Its outcome goes into the channel's `results` entry as `replySweep` or `replySweepError`. It never writes `lastRunStatus`, `lastRunError` or `lastSuccessAt`, and a failure never masks the live verdict or stops the digest.
- Under `DRY_RUN=true`, `forceDryRun`, previews and the dry-run drain, the recheck never runs and never touches its checkpoint columns.
- "Hourly" is a floor. One channel is claimed per tick, so a pass that spans several pages takes several claims.

## Limits

- Per tick: 100 fresh replies, 10 reply lookup calls, 5 pages per thread.
- Per tick: at most 10 reply deletes (`REPLY_DELETE_CAP_PER_TICK`) and no more than the day's remaining quota allows after a 100-unit batch reserve (the floor of the remaining units less 100, over 50). Each further reply delete is stored as a reject, with the text `delete budget reached, hidden instead` appended to its reason. Each reply delete is its own 50-unit `comments.delete` call. A reply hidden instead is a reject, and rejects share `comments.setModerationStatus` calls of up to 50 ids, so a hidden reply costs no more than a delete and less when it shares a call. The cap limits how many delete calls a tick makes.
- Per run, before any call: a run claims at most 100 pending batched reply rows (holds, rejects and bans) and as many pending reply deletes as the day pays for after the reserve. With no ceiling, a quota refusal today, a disabled setting, or fewer than 100 units left, no pending reply row is written. It stays pending until a later run has room.
- Coverage is partial on busy threads. The shortfall shows the owner how many replies the last pass did not cover.
- Each reply is scored on its own text. The parent comment is not part of the scoring context, so terse replies can be scored without their context.
- Each AI-scored reply consumes one credit, as a top-level comment does. Rule matches and protected handles are not charged.
- One channel per tick, and one thread page per claim.

## Quota model

### Unit costs

Recorded in `YOUTUBE_UNIT_COST` (`quota.ts`). The costs are Google's documented costs (see [API facts](#api-facts)):

| Endpoint | Units |
| --- | --- |
| `commentThreads.list` | 1 |
| `comments.list` | 1 |
| `channels.list` | 1 |
| `videos.list` | 1 |
| `comments.setModerationStatus` | 50 |
| `comments.delete` | 50 |

### The meter

- `ytFetch` records the endpoint's cost once per call, before the HTTP retry loop. Retries inside `fetchWithRetry` are not counted. The OAuth token refresh is not a Data API call and is not counted. The meter is therefore a lower bound.
- The meter does not check the run mode. Reads made by dry-run and preview work go through the same `ytFetch` and are counted. `flushQuotaUnits` returns before any write when `DRY_RUN` is `true`, so under `DRY_RUN=true` nothing reaches `youtube_quota_usage`, and the pending units stay in memory. When `DRY_RUN` is not `true`, the units are flushed with the next cron tick, so dry-run reads in a live deployment count toward the day. Preview reads made by the web process share the module-level pending counter, so in a single-process deployment they are flushed with the next cron tick.
- Pending units live in process memory. `flushYoutubeUnits` adds them to one `youtube_quota_usage` row per Pacific day, in one upsert, once per cron invocation, before the response is built. A failed flush keeps the units pending for the next flush and is reported as `quotaFlushError` in the cron response. Units not yet flushed are lost if the process restarts, which is a further reason the meter is a lower bound.
- The Pacific day is the calendar date in `America/Los_Angeles` (`pacificDay`). Google resets quota at midnight Pacific time.
- Table `youtube_quota_usage`: `day` (primary key, `YYYY-MM-DD`), `units` (integer, default 0), `exhausted_at` (ISO instant, NULL unless a quota refusal stamped the day).

### The ceiling

`REPLY_SWEEP_QUOTA_CEILING` is the operator's daily cap for reply checks, in YouTube units per Pacific day. It is read where the recheck is considered, not at handler start (`readReplyCeiling`).

| Value | Result | Reason |
| --- | --- | --- |
| unset or empty | reply checks off | `ceiling-not-set` |
| `0` | reply checks off (kill switch) | `kill-switch` |
| positive whole number | daily cap | none |
| anything else (negative, decimal, text) | reply checks off | `ceiling-invalid` |

Only the recheck is disabled. The cron keeps moderating top-level comments in every case. A disabled ceiling is logged on every tick that reaches the quota gate (`console.error` for unset and invalid, `console.warn` for the kill switch). The channel page shows "Reply checks are paused by a server setting".

When today's units (stored plus pending) reach the ceiling, the tick is skipped with `quota-ceiling-reached` and a warning. The channel page shows the quota pause for that day (state `paused-quota-today`). The sentence it shows for that pause is "YouTube refused a reply check for quota today, so reply checks wait until midnight Pacific time.", which is inaccurate for the ceiling case. Rewording it is an open copy item awaiting the owner. The server load checks whether the ceiling is disabled, whether the day is stamped as exhausted, and whether today's units have reached the ceiling. Besides the pause, the status line shows the pass state, the last-check time when no pass is in flight, and the shortfall, and it shows no unit counts. The cron response carries `replySweep.reason`, and the server log carries the warning.

### Quota exhaustion

A quota-family refusal on the reply fetch or on enforcement stops the pass. `QUOTA_REASONS` are `quotaExceeded`, `dailyLimitExceeded`, `rateLimitExceeded` and `userRateLimitExceeded`. `markQuotaExhausted` stamps today's `exhausted_at`, logs loudly, and the error is rethrown. The pass stays where its last checkpoint left it. The next ticks skip with `quota-exhausted-today` until the Pacific day rolls over, and the channel page shows the quota pause.

Open question: `rateLimitExceeded` and `userRateLimitExceeded` are treated the same as the daily quota. A short per-minute rate limit would therefore pause reply checks until the next Pacific day. This is the current behaviour; it is not confirmed against Google's error semantics.

## Failure handling

- **Parked reply actions.** When YouTube refuses a reply action, or a server or network error still fails after retries, that one action row moves to `state = 'failed'`. In the same transaction the comment returns to `status = 'pending'`, `decided_by = 'none'`, and one audit row is written with `action = 'failed'` and `actor = 'system'`. The row is counted as parked in the enforcement result. Parked rows are never retried automatically.
- **Owner recovery.** The comment is in the review queue as a pending comment. The owner approves, rejects or deletes it there. Reply rows carry the Reply tag, and their action labels end with "(reply)".
- **Network caveat.** A network error can fail after YouTube has already applied the change. The queue may then show a comment YouTube has already changed.
- **Top-level rows keep throw-and-retry.** The parked behaviour applies to reply rows only. A refused reply write does not block the live run's cursor.
- **Enforcement errors that are not quota.** Logged with `console.error`, reported as `replySweepError`. The action rows stay outstanding for a later run, and the checkpoint still advances.
- **Quota refusal during enforcement.** Stamps the day and rethrows. The pass stays in flight, and the cron reports the error.
- **Deadline.** Returns `partial`; nothing is written; the next tick reads the same page.
- **Token refresh failure.** Thrown from the lazy `getAccessToken` and reported as `replySweepError`. If the tick had just started a new pass, the start was already checkpointed, so the pass is in flight at its first page and the next tick reads that page. No page is skipped. If the tick had not started a pass, nothing is written before the failure.
- **Credit deferral.** A reply that cannot be charged defers the batch. The pass is abandoned with `last_at = now` and the reason `out of credits: N reply(ies) deferred`. The next pass restarts from the lookback.
- **Deactivation.** `ChannelDeactivatedError` returns `replySweep: { status: 'partial', reason: 'deactivated' }`.
- **Checkpoint conflict.** Throws, as described under [Checkpoint](#checkpoint). The cron reports it as `replySweepError`.

## Operator runbook

1. **Migrations first.** Apply `drizzle/0075_reply_moderation_columns.sql` and then `drizzle/0076_youtube_quota_usage.sql` to each database before deploying this code. The channel page reads `youtube_quota_usage` on every load. Migrations are run by a human (DEPLOY.md §1). Afterwards, verify the schema actually changed: the six new columns on `channels` and `comments`, and the `youtube_quota_usage` table. Do not rely on the migrate command's exit status alone.
   - Migration 0075 is hand-written. It adds six columns and keeps `channel_allowed_handles.resolved_channel_id`. See [db SPEC](../src/lib/server/db/SPEC.md).
2. **Set the ceiling.** Set `REPLY_SWEEP_QUOTA_CEILING` as a Runtime Variable with Build Variable OFF. The variable is documented in `.env.example` and in [COOLIFY](COOLIFY.md). Leave it unset, or set `0`, to keep reply checks off.
3. **Read the pause states.**
   - "Reply checks are paused by a server setting": the ceiling is unset, `0` or invalid. Look for `reply recheck off: REPLY_SWEEP_QUOTA_CEILING ...` in the server log.
   - "YouTube refused a reply check for quota today": a quota-family refusal stamped today, or today's units at the ceiling. The page shows this same wording for both causes, which is inaccurate for the ceiling case; rewording it is an open copy item awaiting the owner (see [the ceiling](#the-ceiling)). For a refusal, look for `YouTube quota exhausted` in the server log on the tick that stamps the day; later ticks that day log `reply recheck skipped for channel <id>: YouTube quota was exhausted today`. Reply checks resume on the next Pacific day.
   - A day at the ceiling shows as paused-quota-today on the channel page, as does a day YouTube refused. Look for `reply recheck skipped for today: ... reached REPLY_SWEEP_QUOTA_CEILING` in the server log, and `replySweep.reason = quota-ceiling-reached` in the cron response.
4. **Read the cron response.** Each channel's entry under `results` carries `replySweep` (`status`, `reason`, `fetched`, `fresh`, `staged`, `deferred`, `acted`, `queued`, `shortfall`, `ownRepliesSkipped`, and `replyActionFailures`, present only when greater than zero) and, on failure, `replySweepError`. A `replySweepError` makes the scheduled task exit non-zero, so Coolify alerts the operator, as it does for other failed sweeps. A top-level `quotaFlushError` means the day's units did not reach the database. `failureDiagnostics` carries the classified error for each reported failure.
5. **Recover a parked reply.** Parked actions are never retried. Find the comment in the review queue (Reply tag, "(reply)" action labels), or find `failed` rows in the audit log, then approve, reject or delete it. Check the comment on YouTube Studio first: after a network error YouTube may already have applied the change.
6. **Check the meter against Google.** The meter is a lower bound. Compare it with the Cloud Console quota chart before raising the ceiling.
7. **Dry-run deployments.** Under `DRY_RUN=true` no reply check runs, and the owner action refuses to change the setting (HTTP 409).

## API facts

Source: the documentation research pass recorded for this feature. Quotes are reproduced as recorded there. Where a sentence was recorded without its URL, the entry says so.

### commentThreads.list

- "Comment threads are ordered by time. This is the default behavior." (URL not recorded for this sentence; the commentThreads.list method page is the likely source.) The `order=time` parameter sorts by an undocumented timestamp, so the thread walk relies on this ordering as an inference. The live scanner already depends on the same stop rule.
- Embedded replies are a subset: "the list of replies is only a subset of the total number of replies available for the top-level comment" (https://developers.google.com/youtube/v3/docs/commentThreads).
- "The total number of replies that have been submitted in response to the top-level comment." (`totalReplyCount`; https://developers.google.com/youtube/v3/docs/commentThreads).
- Default moderation status: "The default value is published." (https://developers.google.com/youtube/v3/docs/commentThreads/list).
- Quota: "A call to this method has a quota cost of 1 unit." (URL not recorded for this sentence.)

### comments.list

- "The parentId parameter specifies the ID of the comment for which replies should be retrieved." (https://developers.google.com/youtube/v3/docs/comments/list).
- `maxResults` accepts 1 to 100, default 20. The ordering of replies is not documented. The code requests 100 per lookup page.
- Quota: 1 unit (URL not recorded for this sentence).

### Comment resource

- snippet.parentId: "This property is only set if the comment was submitted as a reply to another comment." (https://developers.google.com/youtube/v3/docs/comments).
- `snippet.videoId` is not documented on the comment resource. The reply's video id therefore comes from its thread, not from the reply.

### comments.setModerationStatus

- Quota: "A call to this method has a quota cost of 50 units." (https://developers.google.com/youtube/v3/docs/comments/setModerationStatus).
- banAuthor: "The banAuthor parameter can only be used if the moderationStatus parameter value is rejected." (same page).
- "This action also effectively hides all replies to the rejected comment." (same page).
- "You can't change the moderation status of a rejected comment to published." (same page). The implementation guide (https://developers.google.com/youtube/data/guides/implementation/comments) is recorded as saying the opposite when the unique comment ID is known. The exact sentence was not recorded in the research pass. The two sources conflict on rejected to published; this is unresolved.
- Official sample code calls `setModerationStatus` with `published` on a reply comment ID (https://github.com/youtube/api-samples/blob/master/php/comment_handling.php).

### comments.delete

- The setModerationStatus page says the delete method "can only be used by the comment's original author", and it directs the channel owner to `rejected` instead.

### Quota and errors

- Default pool: 10,000 units per day.
- "Daily quotas reset at midnight Pacific Time (PT)." (https://developers.google.com/youtube/v3/determine_quota_cost).
- Exhausted quota: 403 `quotaExceeded` (https://developers.google.com/youtube/v3/docs/errors).

### Not documented

- Whether `heldForReview`, `rejected` and `banAuthor` accept reply comment ids.
- Whether `comments.delete` works on replies for a channel owner.
- The lifetime of `pageToken`.
- The real latency and the real units a pass uses.

## Verification status

- None of the reply-id behaviour above has been tested against the live YouTube API. The reply-id questions are unverified, and the code is written to fail loudly if a refusal occurs (parked rows, `replySweepError`).
- The dev end-to-end check needs a real channel, a second account that replies under an old thread, and OAuth. It is the operator's to run before production. The e2e fixtures mock only `topLevelComment`, so they do not exercise replies.
- Automated coverage is in `replySweep.test.ts`, `quota.test.ts`, `cron.replies.test.ts`, `enforcement.replies.test.ts`, `feedbackDigest.replies.test.ts`, `replies-settings.test.ts` and `reply-moderation-page.test.ts`.
