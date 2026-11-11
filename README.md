# Moderaty

Moderaty is a source-available YouTube comment protection platform for creators,
licensed under [PolyForm Shield License 1.0.0](LICENSE). It checks top-level
comments on connected channels, applies your rules before AI, and sends uncertain
decisions to a human review queue.

[![Codacy Badge](https://app.codacy.com/project/badge/Grade/a971fb52cb6142efab9a17572f3e3f57)](https://app.codacy.com/gh/Advanced-Digital-Marketing-LTDA/Moderaty/dashboard?utm_source=github&utm_medium=referral&utm_content=&utm_campaign=Badge_grade)

[![Quality gate status](https://sonarcloud.io/api/project_badges/measure?project=Advanced-Digital-Marketing-LTDA_Moderaty&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=Advanced-Digital-Marketing-LTDA_Moderaty)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=Advanced-Digital-Marketing-LTDA_Moderaty&metric=bugs)](https://sonarcloud.io/summary/new_code?id=Advanced-Digital-Marketing-LTDA_Moderaty)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=Advanced-Digital-Marketing-LTDA_Moderaty&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=Advanced-Digital-Marketing-LTDA_Moderaty)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=Advanced-Digital-Marketing-LTDA_Moderaty&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=Advanced-Digital-Marketing-LTDA_Moderaty)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=Advanced-Digital-Marketing-LTDA_Moderaty&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=Advanced-Digital-Marketing-LTDA_Moderaty)
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=Advanced-Digital-Marketing-LTDA_Moderaty&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=Advanced-Digital-Marketing-LTDA_Moderaty)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Advanced-Digital-Marketing-LTDA_Moderaty&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=Advanced-Digital-Marketing-LTDA_Moderaty)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=Advanced-Digital-Marketing-LTDA_Moderaty&metric=sqale_index)](https://sonarcloud.io/summary/new_code?id=Advanced-Digital-Marketing-LTDA_Moderaty)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=Advanced-Digital-Marketing-LTDA_Moderaty&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=Advanced-Digital-Marketing-LTDA_Moderaty)
[![Vulnerabilities](https://sonarcloud.io/api/project_badges/measure?project=Advanced-Digital-Marketing-LTDA_Moderaty&metric=vulnerabilities)](https://sonarcloud.io/summary/new_code?id=Advanced-Digital-Marketing-LTDA_Moderaty)

[![CodeScene general](https://codescene.io/images/analyzed-by-codescene-badge.svg)](https://codescene.io/projects/83771)
[![CodeScene Average Code Health](https://codescene.io/projects/83771/status-badges/average-code-health)](https://codescene.io/projects/83771)
[![CodeScene Hotspot Code Health](https://codescene.io/projects/83771/status-badges/hotspot-code-health)](https://codescene.io/projects/83771)
[![CodeScene System Mastery](https://codescene.io/projects/83771/status-badges/system-mastery)](https://codescene.io/projects/83771)

## What it does

- Connects YouTube channels through Google OAuth.
- Skips rules and AI for protected handles.
- Matches top-level comments against keyword, regex, and blocked-user rules.
- Applies `hold`, `reject`, `delete`, or `ban` actions to matching comments.
- Uses OpenAI moderation and an optional per-channel tone pass for comments that
  rules do not decide — screened for prompt injection first, with flagged
  comments held for human review.
- Routes AI failures and borderline scores to a human review queue instead of
  silently approving or rejecting them. If a check runs out of time, unfinished
  comments retry on a later check instead.
- Records decisions in an audit log and supports `DRY_RUN=true` previews.

Scanning covers published top-level comments on connected, active channels.
Replies are rechecked only on channels whose owner turns on reply moderation (off
by default): replies published after it was turned on, under top-level comments
from the last 72 hours, within the daily YouTube quota set by
`REPLY_SWEEP_QUOTA_CEILING` ([docs/reply-moderation.md](docs/reply-moderation.md)).
Live chat and separate sweeps of YouTube's held-for-review or spam queues are
outside the current scanning scope. History scans use the same
retrieval path, with 1, 3, 6, 12, or 24-month windows. Moderation history can apply
actions; feedback history is read-only. Starting either live history scan requires
purchased credits, available paid subscription allowance, or, for lifetime teams,
a usable OpenAI key.

On the official hosted deployment, an organization with no credits, subscription or lifetime plan
ingests nothing: no YouTube fetch and no AI scoring. The exception is
one free dry run per organization, shared by moderation and feedback previews.
Self-hosted instances are exempt.

Each scheduled run is bounded and checkpointed. It processes one eligible
channel and up to 100 top-level comments per page, records enforcement work in
the database before writing to YouTube, and reconciles unfinished actions on a
later run.

## Feedback digest

The feedback digest is an opt-in, read-only report per channel. An AI pass
classifies each scanned top-level comment's useful claim (recurring questions,
substantive criticism, corrections, requests), a second pass merges recurring
themes, and the digest lists a theme only once enough comments raise it (2 to 10,
set per channel). Abusive wording stays concealed inside the digest. It never
replies, posts, or changes a comment's moderation.

- It runs weekly, every 100 new comments, or on request, and is drained by cron.
- History analysis covers 1, 3, 6, 12, or 24 months and is read-only.
- Each classified comment uses one credit on metered plans, the same as AI
  scoring. A dry run previews the first page (up to 100 comments) and writes no
  digest, evidence, history, or billing rows.
- If clustering fails or returns invalid data, the digest falls back to the
  original per-comment claims and shows a recovery notice; it never invents counts
  ([docs/feedback-clustering.md](docs/feedback-clustering.md)).
- Models are set by `OPENAI_FEEDBACK_MODEL` and `OPENAI_FEEDBACK_CLUSTER_MODEL`.
  `scripts/feedback-eval.mjs` is the live evaluator.

## Plans, credits and teams

Self-hosted Moderaty costs nothing from Moderaty; infrastructure and OpenAI
charges are yours. The hosted service has three paid routes, with current prices
on the public pricing page:

- **Credit bundles.** One credit covers one AI moderation score or one feedback
  classification. Rule and protected-handle decisions use no moderation credit.
  Bundles are bought through Stripe, or through Mercado Pago in BRL. Automatic
  top-up is opt-in and off by default: it charges your saved card for the chosen
  bundle when the balance drops below your threshold
  ([docs/stripe-auto-topup.md](docs/stripe-auto-topup.md)).
- **Hosted monthly plan.** $5 a month with 100 AI classifications shared by
  moderation scoring and feedback digests.
- **Lifetime.** $49 once, capped at 1,000 places, using your own OpenAI key
  stored per organization on the Team page.

Webhook handling for Stripe is documented in
[docs/stripe-checkout-webhooks.md](docs/stripe-checkout-webhooks.md). Optional
accounting integrations (`ADAFLOW_API_TOKEN`, `FOCUS_NFE_TOKEN`) are covered in
`docs/adaflow-api-validation.md` and `docs/focus-nfe-validation.md`.

Each account works inside an organization (team) with three roles. Members work
the review queue, write rules, and read the audit log. Admins also manage
channels and invites. Owners also manage billing, feedback settings, and member
roles.

## Repository overview

Moderaty is a SvelteKit 3 application using Svelte 5, TypeScript, and a
**dual deploy adapter** (the choice is the build-time `MODERATY_ADAPTER` env):
the default Netlify adapter, or adapter-node for the self-hosted Coolify
target (see `DEPLOY.md` and `docs/COOLIFY.md`). Server code
calls the Google and OpenAI HTTP APIs directly — no auth or Google SDKs. The
only third-party runtime SDKs are `stripe` (billing), `@openai/guardrails`
(prompt-injection screening), and `nodemailer` (Proton Mail SMTP), all
server-only.

| Path | Purpose |
| --- | --- |
| `src/routes/` | Landing page, authenticated app pages, OAuth routes, and cron API |
| `src/lib/` | Shared Svelte components, landing-page content, and server modules |
| `src/lib/server/` | Sessions, OAuth, encryption, rules, moderation, pipeline, and database access |
| `drizzle/` | Database migrations for libSQL/SQLite and Turso |
| `netlify/functions/cron.mjs` | Scheduled Netlify function that invokes the cron endpoint |
| `Dockerfile` | Coolify image: migrate+verify gate, node build, non-root runtime (see `docs/COOLIFY.md`) |
| `src/routes/demo/` | Screenshot-only pages that render the real dashboard and channel UI with fictional data; off unless `DEMO_PAGES_ENABLED=true`, always noindex, never in the sitemap |
| `src/routes/tools/` | Public tools, currently the YouTube money calculator |
| `scripts/dev-cron.mjs` | Cron ticker: local dev loop, or Coolify's in-container scheduled task (`--once`) |
| `scripts/` | Local demo-data seeding, live tone calibration, and deploy helpers |
| `docs/` | Manual end-to-end verification notes and the Coolify runbook (`docs/COOLIFY.md`) |
| `DEPLOY.md` | Netlify, Turso, Google OAuth, and cron deployment instructions |
| `docs/COOLIFY.md` | Coolify target: implementation plan and operator runbook |
| `docs/reply-moderation.md` | Reply moderation design, limits, YouTube quota model and operator runbook |
| `EXECUTION_PLAN_YouTube_Comment_Moderator.md` | Implementation plan and system invariants |

The app uses local SQLite through `file:local.db` during development and Turso
in production. Sessions are stored in the database, and YouTube refresh tokens
are encrypted before storage. The application is multi-user: authenticated
queries and mutations are scoped to the signed-in user's channels.

## Local development

### Prerequisites

- Node.js 24+
- npm 11+
- Google Cloud OAuth credentials for sign-in and YouTube channel access
- An OpenAI API key for live moderation runs

### Setup

```bash
git clone https://github.com/Bonobo791/Moderaty.git
cd Moderaty
npm ci
cp .env.example .env
```

Fill in `.env` with the required values. For a local database, keep
`TURSO_DATABASE_URL=file:local.db` and start with `DRY_RUN=true`. Apply the
migrations before starting the app:

```bash
set -a
source .env
set +a
npm run db:migrate
npm run dev
```

Open `http://localhost:5173`. Google OAuth redirect URIs and production setup
are documented in [DEPLOY.md](DEPLOY.md); the manual credential and smoke-test
checklist is in [docs/e2e-verification.md](docs/e2e-verification.md).

To populate the local app with a safe demo channel and sample queue data:

```bash
node --env-file=.env scripts/seed-dev.mjs
node --env-file=.env scripts/seed-dev.mjs --reset
```

The seed script refuses non-local database URLs.

## Configuration

Copy [.env.example](.env.example) and provide these values as appropriate:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth client credentials |
| `APP_URL` | Canonical app URL used for OAuth redirects |
| `PROTOCOL_HEADER`, `HOST_HEADER` | adapter-node (Coolify) only, optional — set only if the proxy rewrites the scheme or `Host`; the old `ORIGIN` variable is ignored |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | Local SQLite or production Turso connection |
| `OPENAI_API_KEY` | AI moderation, tone scoring, and feedback digests |
| `OPENAI_JAILBREAK_MODEL`, `OPENAI_TONE_MODEL` | Optional prompt-injection and tone models; default to `gpt-6-luna` |
| `OPENAI_FEEDBACK_MODEL`, `OPENAI_FEEDBACK_CLUSTER_MODEL` | Optional feedback classification and clustering models; default to `gpt-6-luna` |
| `CRON_SECRET` | Secret for scheduled and manual cron requests |
| `ENCRYPTION_KEY` | Key used to encrypt stored YouTube refresh tokens |
| `DRY_RUN` | Must be `true` or `false`; `true` records audit previews without durable moderation changes |
| `MODERATY_DEPLOYMENT` | `self-hosted` (the `.env.example` default) or `official-hosted`; only the official hosted operator sets `official-hosted`, on the hosted database. It switches on the paid-ingestion gate and the hosted welcome e-mail |
| `WELCOME_EMAIL_ENABLED` | Optional; on `official-hosted` the first welcome e-mail sends by default, `false` pauses discovery and delivery (`docs/hosted-welcome-email.md`) |
| `UNLIMITED_ACCESS_EMAILS` | Comma-separated owner e-mails with complimentary unlimited access; runtime variable only, never commit the addresses. Empty grants nobody; unset makes the billing checks throw |
| `REPLY_SWEEP_QUOTA_CEILING` | YouTube quota units per Pacific day that reply checks can spend; unset or `0` turns reply checks off (`docs/reply-moderation.md`) |
| `DEMO_PAGES_ENABLED` | Dev only, default `false`; `true` serves the screenshot-only `/demo` pages |
| `MODERATY_ENVIRONMENT`, `MODERATY_RELEASE` | Optional operational-event labels: environment is `development`, `test`, `staging` or `production`; release is a 7–40 character lowercase git SHA or `x.y.z` |
| `PROTON_SMTP_USERNAME`, `PROTON_SMTP_TOKEN` | Proton Mail SMTP submission credentials for transactional e-mail (contact-form verification, zero-credit warnings) |
| `PROTON_FROM_NAME` | Optional sender display name; defaults to `Moderaty` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe billing credentials for credit bundles and hosted/lifetime plans |
| `STRIPE_PRICE_CREDITS_*`, `STRIPE_PRICE_HOSTED_MONTHLY`, `STRIPE_PRICE_LIFETIME` | Stripe Price ids for the credit bundles, the hosted monthly plan, and lifetime access |
| `STRIPE_TEST_PRODUCT` | Optional operator-only "Test checkout" card that runs a real end-to-end purchase |
| `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` | Optional Mercado Pago BRL prepaid-credit checkout credentials |
| `MERCADOPAGO_ENVIRONMENT`, `MERCADOPAGO_PRICE_CREDITS_*_BRL_CENTS` | Optional Mercado Pago mode and BRL bundle prices in cents |
| `ADAFLOW_API_TOKEN` | Optional AdaFlow accounting-export Bearer token (`docs/adaflow-api-validation.md`) |
| `FOCUS_NFE_TOKEN`, `FOCUS_NFE_ENVIRONMENT` | Optional Focus NFe NFS-e emission credentials (`docs/focus-nfe-validation.md`) |
| `ANALYTICS_ENABLED`, `UMAMI_URL`, `UMAMI_WEBSITE_ID`, `ANALYTICS_ALLOWED_HOSTNAMES` | Optional self-hosted audience measurement; runtime only, disabled by default |

Never commit `.env` or real credentials. Netlify environment-variable setup is
covered by [DEPLOY.md](DEPLOY.md).

Self-hosted Umami audience measurement is optional and disabled by default:
unchanged forks make no collector requests. Supply your own collector origin,
website UUID and exact hostname allowlist in hosting runtime settings. Public
pageviews and approved marketing clicks use restricted payloads; account flows
are excluded. See [analytics setup](docs/ANALYTICS.md) for activation requirements,
visitor preferences, retention and runtime verification.

## Useful commands

```bash
npm run dev          # Start the development server
npm run dev:cron     # Tick the cron endpoint alongside the dev server
npm run check        # Run SvelteKit sync and strict TypeScript diagnostics
npm run test         # Run the Vitest suite
npm run build        # Build (default Netlify adapter; MODERATY_ADAPTER=node for Coolify)
npm run preview      # Serve the production build locally
npm run db:migrate   # Apply Drizzle migrations
npm run db:verify    # Verify every journaled migration is applied (read-only)
```

The test suite includes route, OAuth, session, database, moderation, pipeline,
and UI-state tests. The tone and feedback evaluators are separate live API
checks:

```bash
node scripts/tone-eval.mjs
node scripts/feedback-eval.mjs
```

## Testing and CI

Beyond the Vitest suite, the repository runs:

- Mutation tests with Stryker (always with `--ignoreStatic`) and property tests
  with fast-check.
- Real-browser tests with Playwright: `npm run test:e2e` and
  `npm run check:e2e`.
- Ratchets: `npm run ratchet` fails when test, suppress, or type counts move the
  wrong way; `npm run ratchet:update` locks in an improvement. The base branch's
  scripts and baselines judge each PR.
- AgentShield: `npm run scan:agents` scans the agent configuration
  ([docs/testing/agentshield.md](docs/testing/agentshield.md)).

GitHub Actions workflows in `.github/workflows/`: `checks`, `ratchets`, `merge-evidence`
(the "Merge evidence verification" check, [docs/merge-evidence-gate.md](docs/merge-evidence-gate.md)),
`overlock` (test integrity audit), `adversarial-review`, `claude-code-review`,
`rewardguard` (code and content review), `eslint`, `dependency-review`, `ossar`,
and `refactoring-agent`. The Codacy, Semgrep, and Sonar local commit gates were
removed in #299. The Test Quality Sentinel is disabled
([docs/TEST_QUALITY_SENTINEL.md](docs/TEST_QUALITY_SENTINEL.md)).

## Accounts and hosting

Users sign in with Google identity (`openid email profile`) and then grant a
separate `youtube.force-ssl` consent to connect a channel. Self-hosted
instances use the same code path and bring their own Google, OpenAI, and Turso
credentials. Moderaty supports two deploy targets: the managed **Netlify**
target (Scheduled Function, see [DEPLOY.md](DEPLOY.md)) and the self-hosted
**Coolify** target (Dockerfile + in-container scheduled task, see
[docs/COOLIFY.md](docs/COOLIFY.md)); both use Turso as the
production database and share the same `DRY_RUN`-first verification flow.
Transactional e-mail (contact-form verification and zero-credit warnings)
goes out through Proton Mail SMTP submission.

On the official hosted deployment (`MODERATY_DEPLOYMENT=official-hosted`),
organizations without credits or a subscription cannot ingest, and organizations
whose owner e-mail is listed in `UNLIMITED_ACCESS_EMAILS` get unlimited access
with the deployment's OpenAI key. Lifetime organizations must store their own
OpenAI key on the Team page; they never fall back to the deployment key.

Also in the codebase:

- **Languages.** English and Brazilian Portuguese (`pt-BR`). Only `/login` and
  `/account-deleted` switch language; the language switcher posts to
  `/api/locale`. Legal documents stay English until a reviewed Portuguese
  translation is published ([docs/I18N.md](docs/I18N.md)).
- **Backups.** Turso-managed backups and point-in-time recovery; there is no
  Moderaty backup job ([docs/BACKUP_RECOVERY.md](docs/BACKUP_RECOVERY.md)).
- **Operational events.** Safe, structured events with request correlation. The
  environment label comes from `MODERATY_ENVIRONMENT` or `NODE_ENV`.
- **Cron fairness.** Feedback previews and live moderation alternate on the
  shared cron runner ([docs/cron-workload-fairness.md](docs/cron-workload-fairness.md)).
- **Contact and welcome e-mail.** Verified contact messages with inbox delivery,
  and the first hosted welcome e-mail ([docs/hosted-welcome-email.md](docs/hosted-welcome-email.md)).
- **Public content.** Blog articles at `/blogs`, creator guides at `/guides`, and
  the YouTube money calculator at `/tools/youtube-money-calculator`.

The `/demo` pages are for screenshots only: no database, sign-in, consent, cron,
YouTube or OpenAI call. They return 404 unless `DEMO_PAGES_ENABLED=true`, and
fail with a 500 when `APP_URL` is `moderaty.com` or the Google client is the
production one. Never enable them on `moderaty-prod`.

## License

Moderaty is source-available under a dual-license model:

- **PolyForm Shield 1.0.0:** [LICENSE](LICENSE) — free to use, self-host,
  modify, and distribute, including for commercial purposes, provided that
  you do not use Moderaty to provide a product or service that competes with
  Moderaty or another product or service provided by Advanced Digital
  Marketing LTDA using Moderaty.
- **Commercial license:** available for competing hosted services,
  competing white-label products, competing SaaS offerings, or other uses
  not permitted by the PolyForm Shield License.

For commercial licensing, contact
[contact@Moderaty.com](mailto:contact@Moderaty.com).

See [COMMERCIAL.md](COMMERCIAL.md).

Copyright (C) 2026 Advanced Digital Marketing LTDA.
