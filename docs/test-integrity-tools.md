# Test integrity tools

## CI inventory

| Tool | State | CI behavior | Boundary |
| --- | --- | --- | --- |
| Overlock (`rxova/overlock`) | Already installed on `main`; retained | Pinned action and npm engine analyze PR diffs using the repository audit policy. Commenting is off and permissions stay read-only. | Structural checks can flag suspicious edits; they do not prove application correctness. |
| Merge-Evidence Gate (`axigatelabs/merge-evidence-gate`) | Already installed on `main`; unchanged | Runs its existing PR workflow and full test command, then verifies receipt and report evidence. | It reruns the test command and does not prove application correctness. Reusing the existing `checks` workflow report is a separate follow-up; report mode trusts the supplied report rather than independently verifying that the tests produced it honestly. |
| TestTrust (`corgu1995/testtrust`) | Added on the task branch | Pinned v0.1.9 (`5f468c50285cab751f7756f76e4b8f305c50e2de`) action analyzes the PR test diff with `fail-under: 86`, enforcing a score strictly above 85. It compares against the base commit SHA recorded in the pull request event and fails if that commit is unavailable. Comments are disabled; it receives no write permission. An output verifier rejects missing scores/verdicts and enforces the same strict boundary. | Targets Jest/Vitest-style JS/TS tests. Playwright coverage is not guaranteed. A block-bodied assertion weakening and a legitimate test addition are exercised as synthetic controls. In source review, a concise arrow-expression assertion was missed by the assertion detector; this tool is not exhaustive. |
| Stryker | Already installed as dev dependencies and configured at 9.6.1 | Local/agent-driven only, consistent with `MUTATION_TESTING.md`; no CI mutation run was added. | Stryker always runs with `--ignoreStatic` per `AGENTS.md`. |

Gatekeep is intentionally excluded. None of these tools establishes application correctness.
