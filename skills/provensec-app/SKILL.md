---
name: provensec-app
description: Mechanical security scan of an app's code, with zero dependencies (Node and git only, nothing installed, nothing leaves the machine). Finds leaked keys and passwords on disk and in the full git history (Stripe, AWS, Supabase service role, GitHub, OpenAI and 16 more formats), tracked .env files, insecure defaults (secret with a hardcoded fallback, CORS open to any origin, admin key shipped to the browser) and dangerous patterns (raw HTML on screen, SQL built from text, shell commands built from text). Vulnerable dependencies only with --dependencies, which contacts npm. A stage that did not run shows as ❌, never as green. Live app and API are tested by hand with the guides in guides/. Triggers "any secrets in the code?", "did a key leak?", "audit dependencies", "scan the repo", "review the app's security". Not for servers or VPS.
license: MIT
metadata:
  version: 1.0.0
---

# provensec-app

Secrets, code and dependencies, with mechanical evidence and **nothing to install**. It runs
on its own: no running app, no test credentials, no second account.

```bash
node <this-skill-dir>/scripts/provensec-app.mjs [--dir <folder>]
```

| Exit | Meaning |
|---|---|
| **0** | Everything ran and there are no critical or high candidates |
| **1** | Some stage **did not fully run** (folder without git, git failed). Declared gap, NOT a green |
| **2** | Critical or high candidates found |

Options: `--dir <folder>` · `--full-history` · `--commits N` (default 400) ·
`--max-file-mb N` (default 1) · `--dependencies` · `--json`

## Zero dependencies, and what that costs

Only Node and git. **The cost, said plainly:** this is text pattern matching, line by line.
It does not understand code structure the way a parser-based tool does, so it flags things
that are fine and misses things written differently. That is why the output calls every
line a **candidate**, and every candidate goes through
[`../provensec/verdict.md`](../provensec/verdict.md) before it becomes a finding.

## What each stage covers

| Stage | How | Catalog items |
|---|---|---|
| Secrets on disk and in history | 21 key formats over current files and over every added line in `git log -p` for the folder. A tracked `.env` is a finding by itself | A02, A05 |
| Dangerous and insecure code | 14 rules over JavaScript and TypeScript files (Next.js, React, Vue, Svelte, Astro) | A02, A05, A11, A12, A14, A24, A27, A29, A35, A36, A38 |
| Vulnerable dependencies | `npm audit`, **only with `--dependencies`** | A28 |

The rules live in [`scripts/rules.mjs`](scripts/rules.mjs), and their tests in
[`scripts/rules.test.mjs`](scripts/rules.test.mjs): every rule has one case it **must** flag
and one it **must not**. Changed a rule? Run:

```bash
node <this-skill-dir>/scripts/rules.test.mjs
```

The 43-item catalog is in [`../provensec/catalog.md`](../provensec/catalog.md).

## Four design decisions, and why

**A credential's value never appears.** The output is only a hint: `len 46 · …a1b2`. The
owner rotates the key, and to rotate it they do not need the value in a terminal or a log.

**A key in history is worse than a key on disk.** Deleting the file does not remove it from
git. A candidate that exists only in history says so: rotate it.

**Placeholders are not secrets.** Values with `example`, `your_`, `xxxx`, `${`, `process.env`
and similar are dropped before becoming candidates, and so is Supabase's `anon` key, which is
public by design. ⚠️ The filter has a cost: a real key that contains `12345678` or `abcdef`
slips through.

**Nothing leaves the machine unless you ask.** The dependency stage sends your package list
and versions to the npm registry. That is why it only runs with `--dependencies`; without it,
it shows as `–` (not requested) and does not count as a gap. When it runs, the report
separates **direct** from **transitive**: `npm audit` does not know whether your code calls
the package, and calling it reachable would be invention.

## Before trusting a green

Run it against a case you know is bad and confirm it flags. The controls that proved this
version:

| Control | Result |
|---|---|
| `rules.test.mjs` | 70 cases, 0 failures, no rule without a case |
| Fake repo with a live Stripe key committed and then deleted, plus four planted patterns | All five flagged, the key through history with only its hint, exit 2 |
| Clean fake repo | No candidates, exit 0 |
| Folder without git | Exit 1: history was not scanned, and that is not a green |
| A real repo with an API token committed in an old `.env` | Found the same token a dedicated secret scanner had found, with the same hint, in one second, plus the tracked `.env` |

## What this stage does not do

| Item | Why |
|---|---|
| Live app, sessions, IDOR | Not mechanical: by hand, with the catalog and the guides in `guides/`, and it needs an environment you own and two accounts |
| Understand data flow | Text matching does not know whether a variable came from the user. That is question 2 of the verdict, answered by hand |
| Say whether a vulnerable dependency is reachable | `npm audit` does not know, and inventing it would be worse than not saying |
| Rotate a leaked credential | The owner rotates it. ProvenSec warns, gives the hint and asks |
| Python, Go, Rust | Code rules read JavaScript and TypeScript only. The secret scan reads any text file |

## Guides for the stages that are not mechanical

The live app and the API are tested by hand with the guides in [`guides/`](guides/): IDOR
and function-level authorization, adapted from Strix (Apache 2.0). Each says what it needs
first (two test accounts, a target you own) and what counts as evidence. Mass assignment, race
conditions, business logic, JWT and CSRF link from the catalog to the original guides in
Strix. Every other catalog item carries its own test in the "How to test" column.
