---
name: provensec
description: 'Security review where nothing is "secure" until proven. Routes to three tracks. App code at rest (provensec-app) finds leaked keys on disk and in the full git history, insecure defaults and dangerous code patterns, with zero dependencies (Node and git only, nothing leaves the machine). Live app and API are tested by hand with a 43-item catalog and testing guides. Third-party skills are audited before install (provensec-skill-audit). Every candidate starts dismissed and must survive three questions; every stage reports coverage, and what did not run is never shown as green. Use when asked to review an app''s security, look for leaked secrets, audit dependencies, check a skill, plugin or MCP before installing, or when a password, key or token shows up in chat or logs. Triggers "review the security", "is this exposed?", "did the key leak?", "is this skill safe?", "security audit". Not for UI, accessibility or general code quality.'
license: MIT
metadata:
  version: 1.0.0
---

# ProvenSec

**Not secure until proven.** The rule behind everything here: "it is secure" is something
a machine verifies, not something an agent feels. Exit 0, or it is not ready.

## Route before reading

| The request is about | Load | How it is checked |
|---|---|---|
| **App code at rest:** leaked keys on disk and in git history, insecure defaults, dangerous patterns, dependencies | [`../provensec-app/SKILL.md`](../provensec-app/SKILL.md) | Mechanical. Zero dependencies |
| **Live app and API:** open routes, other users' data, sessions, forms | [`catalog.md`](catalog.md) and the guides in [`../provensec-app/guides/`](../provensec-app/guides/) | By hand, with a guide. Labeled `WEAK EVIDENCE (manual audit)` |
| **A third-party skill, plugin or MCP**, before it is installed | [`../provensec-skill-audit/SKILL.md`](../provensec-skill-audit/SKILL.md) | Mechanical candidate list, decided by hand |
| **A server or VPS** (firewall, SSH, open ports, TLS, exposed database) | Not bundled. Use the MIT package [`@onovoprogramador/onp-security-vps`](https://www.npmjs.com/package/@onovoprogramador/onp-security-vps) by Vitor Manoel, which follows the same philosophy: a guard that blocks weakening actions and a mechanical gate | Its own 42 rules and exit codes |

**Always start the live-app track with A04, the private-window test:** open the app with no
session and try every route that should require login. Five minutes, binary result, and if
it fails the rest of the audit can wait.

## How a candidate becomes a finding

One rule for every track: [`verdict.md`](verdict.md). Every candidate starts **dismissed**
and only becomes a finding if it survives three questions (does it reach production? does
the attacker control the input? is the protection really missing?). Every stage ends in one
of four states: **confirmed**, **dismissed with file and line**, **no candidates** (which
does not prove absence) or **not verified**, with the name of the gap.

## What ProvenSec never does

| Never | Why |
|---|---|
| Send code, diffs or skills to a third-party service | Nothing leaves the machine. **One exception, only when you ask:** `--dependencies` runs `npm audit`, which sends your package list and versions to the npm registry |
| Require installing a tool | Node and git, which you already have. No `brew install`, no Docker, no Python, no API key |
| Probe a target by itself | The scripts read files and git history, and never probe a host. The only network call is `npm audit`, only with `--dependencies`. Live-app and API tests are done by hand, only against something you own, never against production without the owner saying so. Chat does not widen the scope |
| Show a credential's value | Only a hint (`len 46 · …a1b2`). Whoever owns the key rotates it |
| Call green what did not run | A stage that did not fully run is ❌ with the name of the gap |

## Three rules for every track

1. **Never weaken to solve.** Turning auth off "to test", CORS `*`, disabling TLS
   verification, `chmod 777`. The fix never makes the app weaker.
2. **Never call it done without the green gate, with its output pasted.** A previous run's
   evidence does not count: what changed since then is what you want to prove.
3. **Never handle a credential's value.** Warn, record only the hint, ask for rotation.

## A stage that did not run shows in the report

With ❌ and the name of the gap. No app running, no second test account, folder without git:
each of these has a name, and the name is written down. A report that hides the gap becomes
a plausible-looking list, which is the exact defect this skill exists to avoid.
