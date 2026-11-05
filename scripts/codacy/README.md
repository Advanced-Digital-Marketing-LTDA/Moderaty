# Codacy quality gate

The repo is wired with a **Codacy pre-push gate**: before a `git push` completes,
the official [Codacy MCP server](https://www.npmjs.com/package/@codacy/codacy-mcp)
runs a local analysis (in-process `@codacy/analysis-runner`, no Docker needed)
on the changed files, and the push is **blocked** when any changed file carries an
error-level (critical/major) finding. `scripts/hooks/pre-commit` runs the same
gate on *staged* files, after an `eslint-plugin-sonarjs` pass (SonarQube rules,
`scripts/eslint.sonarjs.config.mjs`).

## How it works

- `scripts/hooks/pre-commit` — sonarjs (staged files) then the Codacy gate.
- `scripts/hooks/pre-push` — the git hook (wired via `git config core.hooksPath
  scripts/hooks`). Collects the files being pushed, filters to code files, and
  invokes the gate.
- `scripts/codacy/pre-push-gate.mjs` — spawns the MCP server over stdio and runs
  `codacy_cli_analyze` once per changed file (`file=<path>`) for up to 5 changed
  files, or once for the whole repository (`rootPath=<repo>`) above that, and once per
  tool. `--hook=pre-commit` runs semgrep, biome, shellcheck and hadolint; `--hook=pre-push`
  adds trivy, which never runs on commit. It keeps
  results for changed files with `level === "error"` and exits 1 (block) or 0 (allow).

The gate **fails closed**: a missing MCP server, an analysis error, a push whose
changed files cannot be listed, or a missing eslint in pre-commit all block, and
the block message prints the fix and the scoped override.

## Setup (one-time, per machine)

```bash
npm install -g @codacy/codacy-mcp          # the MCP server the gate spawns
git config core.hooksPath scripts/hooks    # activate the hooks in this clone
```

The gate locates the global `codacy-mcp-server` binary via the npm prefix
(env, `~/.npmrc` under `$HOME` *and* the passwd-entry home — they diverge in
distrobox — then the Node install layout), a controlled PATH scan, or the
`CODACY_MCP_SERVER` env pin for exotic installs.

## Escape hatches

- `CODACY_GATE_OFF=1 git push` (or `git commit`) — skip the Codacy gate for that command.
- `SONARJS_GATE_OFF=1 git commit` — skip the sonarjs gate (pre-commit only).

## First run

The first analysis auto-initializes the repo (`codacy-cli init` equivalent:
writes `.codacy/codacy.config.json` + baseline and downloads tool runtimes into
`~/.codacy/runtimes`) — allow a few minutes. Subsequent runs use the cached
runtimes.

## Agent workflow

Agents should also run the analysis **before finishing work**, not just at push
time. In the kernel:

```python
import codacy
await codacy.list_tools()                       # discover tools
await codacy.codacy_cli_analyze(rootPath=".")   # local analysis (no token needed)
```

Cloud tools (repo issues, security findings, PR analysis) need a token in
`~/.prime/agent/codacy/server.env` (`CODACY_ACCOUNT_TOKEN`, from
https://app.codacy.com/account/access-management). The repo key on Codacy would
be `gh/Advanced-Digital-Marketing-LTDA/Moderaty`.

## Biome rules turned off

Rules: `useTemplate`, `noDescendingSpecificity`.

- `useTemplate` is off: the dynamic-import cache-buster and the `</script>` source split are deliberate concatenations.
- CSS cascade order is intentional; reordering risks visual regressions.
