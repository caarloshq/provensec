# ProvenSec

**Not secure until proven.**

A security skill for AI coding agents built on one rule:
"it is secure" is something a machine verifies, not something an agent feels. Every
candidate starts dismissed, every stage reports what it covered, and a check that did not
run is never shown as green.

Zero dependencies. Node and git, which you already have. Nothing is installed, and nothing
leaves your machine.

## Install

```bash
npx skills add caarloshq/provensec
```

The [skills CLI](https://skills.sh) installs into the agents it supports, such as Claude Code
and Codex. Or, as a Claude Code plugin:

```
/plugin marketplace add caarloshq/provensec
/plugin install provensec@provensec
```

Then ask your agent: *"review the security of this app"*, *"did any key leak in this
repo?"*, or *"is this skill safe to install?"*.

## What it checks

| Track | How | What |
|---|---|---|
| **App code at rest** | Mechanical | Leaked keys and passwords on disk **and in the full git history** (21 formats: Stripe, AWS, Supabase service role, GitHub, OpenAI, Anthropic and more), tracked `.env` files, 14 insecure or dangerous code patterns for JavaScript and TypeScript. Dependencies with `npm audit`, only if you ask |
| **Live app and API** | By hand, with a catalog | 43 findings ordered by damage and effort, each with how to test it and how to fix it. Starts with the 5-minute private-window test |
| **Third-party skills** | Mechanical list, decided by hand | Hidden instructions to the agent, credential reads, data sent out, download-and-execute, hooks and settings changes, persistence, compiled files |

Servers are not bundled: for a VPS, use
[`@onovoprogramador/onp-security-vps`](https://www.npmjs.com/package/@onovoprogramador/onp-security-vps),
which follows the same philosophy.

## What makes it different

- **Nothing leaves your machine.** No code, diff or skill is sent to a model or a service.
  The one exception is `--dependencies`, which sends your package list to the npm registry,
  and only when you ask.
- **A missing check is never a green.** Folder without git, no second test account, a file
  it could not read: each one is reported by name, and the exit code says "not ready".
- **Every candidate starts dismissed.** It becomes a finding only if it reaches production,
  the attacker controls the input, and the protection is really missing. What was dismissed
  carries the file and line that dismissed it.
- **Secrets are never printed.** Only a hint: `len 46 · …a1b2`.
- **Its scripts do not touch the network.** They read files and git history. The only
  network call is `npm audit`, and only with `--dependencies`.
  The live-app guides are written for targets you own, never production without the owner.

## Run the scanners directly

```bash
node skills/provensec-app/scripts/provensec-app.mjs --dir path/to/app
node skills/provensec-skill-audit/scripts/scan.mjs path/to/downloaded-skill
```

| Exit | App scan | Skill audit |
|---|---|---|
| 0 | Everything ran, nothing critical or high | Nothing found, every file read |
| 1 | A stage did not fully run: not a green | Invalid folder |
| 2 | Critical or high candidates | Candidates to decide |
| 3 | | Nothing found, but some file was not read: not a green |

## Limits

- The app scan is **text pattern matching**, line by line, not a parser. It flags things that
  are fine and misses things written differently. That is why its output is a candidate
  list, and the verdict rule decides.
- 21 key formats, not hundreds. Dedicated secret scanners know more providers.
- Code rules cover JavaScript and TypeScript only.
- Testing guides are bundled for IDOR and function-level authorization. Mass assignment,
  race conditions, business logic, JWT and CSRF link to the original guides in
  [Strix](https://github.com/usestrix/strix). Every other catalog item carries its test in
  the catalog itself.

Tests for every rule: `node skills/provensec-app/scripts/rules.test.mjs` (70 cases).

## Credits

Built on ideas and material from Strix, Trail of Bits, VibeSec and NVIDIA SkillSpector. See
[THIRD_PARTY.md](THIRD_PARTY.md).

## License

MIT. See [LICENSE](LICENSE). Guides adapted from Strix remain under Apache 2.0.
