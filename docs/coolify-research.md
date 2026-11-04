# Coolify — Deployment Research

Date: 2026-08-17 · Sources: coolify.io/docs (current docs), coollabsio/coolify GitHub.
All claims verified against the cited pages; anything not verifiable is marked UNVERIFIED.

---

## 1. Coolify — Git auto-deploy ("push to deploy")

**Yes.** With a GitHub App connected, Coolify redeploys on every push to the configured branch.

- Docs: "Automatically deploy new versions of your application when commits are pushed to a **specific branch**" — https://coolify.io/docs/applications/ci-cd/github/overview ; https://coolify.io/docs/applications/ci-cd/github/auto-deploy
- **Setting that controls it:** Application → **Advanced** → "Auto Deploy" toggle ("Enabled by default", and "only available for GitHub App based repositories"): https://coolify.io/docs/applications#auto-deploy . "Coolify automatically enables Auto Deploy after you set up your GitHub App. If it doesn't, enable it on your application": https://coolify.io/docs/applications/ci-cd/github/auto-deploy#github-app
- **Branch:** set when creating the resource (build-pack step: "Branch: Coolify will automatically detect the branch in your repository", editable): https://coolify.io/docs/applications/build-packs/dockerfile (step 5).
- **Webhooks vs GitHub App:** two different trigger mechanisms.
  - *GitHub App* (recommended): no repo-level webhook needed. During App setup Coolify registers a **webhook endpoint** for the App itself (`https://<your-coolify>/webhooks/source/github/events`, push + pull_request events, App webhook secret); "Select the endpoint for github to send Webhook when a event (commit, pr) happens on github. **If this endpoint is not reachable then automatic deployments won't work**": https://coolify.io/docs/applications/ci-cd/github/setup-app ("Set Webhook Endpoint", "Subscribe to events → Push"). The CI/CD page calls GitHub-App integration "Full integration with automatic webhooks": https://coolify.io/docs/applications/ci-cd
  - *Coolify-generated webhook URL (per git source)*: alternative for repos **without** the GitHub App (public repo / deploy key). Enable Auto Deploy, copy Coolify's webhook URL + secret, add it on the GitHub repo (Settings → Webhooks: Payload URL, Secret, "Just the push event", SSL verification on): https://coolify.io/docs/applications/ci-cd/github/auto-deploy#webhooks . With a GitHub App install you do **not** use this per-repo URL.

## 2. Coolify — Dockerfile build pack passes env vars as build ARGs

**Yes, confirmed explicitly.**

- "Coolify automatically injects build arguments into your Dockerfile during the build process. These include environment variables you've configured and predefined system values like SOURCE_COMMIT. … **By default, Coolify injects Docker build arguments (ARG statements) into your Dockerfile**" (can be disabled in the Advanced menu): https://coolify.io/docs/applications/build-packs/dockerfile#build-arguments
- "Build variables are injected during the image build process. **For Dockerfile deployments, they are added as ARG instructions.**" Every env var has independent **Build Variable** and **Runtime Variable** flags, both **on by default**; build vars are passed as `--build-arg KEY=value` (optionally via Docker BuildKit secrets `--secret id=KEY,env=KEY` if "Use Docker Build Secrets" is enabled): https://coolify.io/docs/knowledge-base/environment-variables
- **So `ARG TURSO_DATABASE_URL` + using it in a `RUN` step works**, as long as the variable exists in the app's Environment Variables and its "Build Variable" flag is on (default). Caveat: `SOURCE_COMMIT` is **excluded** from builds by default (cache preservation; enable "Include Source Commit in Build").

## 3. Coolify — Post Deployment Command

**Confirmed.**

- "Pre-deployment: Optionally, specify a script or command to execute **in the existing container before deployment**… Post-deployment: Optionally, specify a script or command to execute **in the newly built container after deployment completes**. This command is also executed with `sh -c`.": https://coolify.io/docs/applications/build-packs/dockerfile#prepost-deployment-commands
- **Where in UI:** "You can configure these settings in the **Advanced menu of your application**" (same page). UNVERIFIED: the exact tab label in the current UI ("Advanced" per the same page) — screenshots not published.
- **Caveats:** runs via `sh -c` inside the container (non-interactive; no TTY). It fires *inside the app container* and runs once per successful deployment.

## 4. Coolify — Scheduled Tasks (cron)

**Exist and are application-level**, though the current docs have no dedicated setup page (sitemap has none → UI path UNVERIFIED).

- Cron engine documented: standard `* * * * *` plus predefined strings (`daily`, `@daily`, `hourly`, …): https://coolify.io/docs/knowledge-base/cron-syntax
- Scheduled-task events + payloads (`task_success` / `task_failed` with `task_name`, `task_uuid`, `output`, and "**application_uuid** … included for application-level tasks"): https://coolify.io/docs/knowledge-base/webhook-payloads#scheduled-tasks
- Notifications support "Scheduled Task Success / Failure" events: https://coolify.io/docs/knowledge-base/notifications#scheduled-tasks
- UNVERIFIED by current docs: (a) the exact UI location (older versions: application settings → Scheduled Tasks); (b) the explicit statement that the command runs **inside the app container** — strongly implied (application-level tasks with captured `output`), but not stated on the pages above.

## 5. Coolify — outgoing webhooks (deployment lifecycle events)

**Exists, but the model changed vs the assumption:**

- Current docs describe a unified **Notifications** system ("Notifications tab of your Coolify dashboard"), with a **Webhook** channel (Notifications → Webhook → enter URL → enable): https://coolify.io/docs/knowledge-base/notifications#webhook
- **Events (current naming):** `deployment_success`, `deployment_failed`, `status_changed` for applications, plus `backup_*`, `task_*`, server/container events. **NOT `deployment.success`/`deployment.failure`** (dot notation was the old naming) — https://coolify.io/docs/knowledge-base/webhook-payloads#application
- **Payload shape:** all events are HTTP POST, `Content-Type: application/json`, minimum fields `success`, `event`, `message`; deployment events add `application_name`, `application_uuid`, `deployment_uuid`, `deployment_url`, `project`, `environment`, `fqdn` (PR previews: `pull_request_id`, `preview_fqdn`).
- Events are selectable per notification channel ("configure different events for each notification channel").
- **Per-application "Webhooks" tab:** UNVERIFIED — no current docs page describes per-application webhook config; only the global Notifications tab is documented. (Older Coolify had a per-app webhook URL/secret; do not rely on it without checking your version's UI.)

---

## Suggested wiring (per findings)

1. Coolify: GitHub App source → branch auto-detect/select, Auto Deploy on (default). Webhook endpoint of the GitHub App must be reachable.
2. Dockerfile build pack: the TURSO_* build variables arrive as **BuildKit secret mounts** (`--mount=type=secret,id=TURSO_DATABASE_URL,env=TURSO_DATABASE_URL` — Coolify's "Use Docker Build Secrets" passes them as `--secret id=KEY,env=KEY`). Never `ARG`/`--build-arg`: build args are visible in build history and can leak into baked layers (docker:S6472).
