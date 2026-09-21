# Verdict: how a candidate becomes a finding

> The single rule ProvenSec uses to decide what goes into a report, for the app and
> third-party-skill tracks. Ideas from two sources, **rewritten in our own words**: the
> refutation-first verification flow from Trail of Bits (`insecure-defaults`, `fp-check`,
> `variant-analysis`, CC BY-SA 4.0, so no text was copied) and the three-state closure
> from Strix (`analysis/counterevidence.md`, Apache 2.0).

## The inversion

Scanners and models fail in the same direction: they see too many problems and rate them
too high. So **every candidate starts as dismissed**, and only becomes a finding if it
survives the three questions below, **in this order**. The first one it fails ends it, and
the report says which one.

Before the questions, **restate the candidate in your own words**: who attacks, how they
get in, what they get. Half of the false alarms die here, because the sentence does not hold.

| # | Question | Fails when | Evidence required to pass |
|---|---|---|---|
| 1 | **Does it reach production?** | The code is a test, an example, dead code, or runs only in development | The path from a public entry point to the code, with file and line |
| 2 | **Does the attacker control the input?** | The value comes from the server, an environment variable, or a trusted admin | Where the value comes from, with file and line, and why a user can reach it |
| 3 | **Is the protection really missing?** | There is an earlier check, type validation, a database policy, a header at the edge | The search for the protection, done and not found, saying where you looked |

⚠️ **An environment variable with a fallback is a special case.** If the code says
`process.env.SECRET || 'dev'`, question 2 does not dismiss it: check whether production
(Vercel, your server) really sets the variable. It does not, or you cannot see? The
candidate survives.

## The four report states

No stage ends in "nothing found". It ends in one of these four:

| State | Meaning | What must be written |
|---|---|---|
| **CONFIRMED** | Passed all three questions | The evidence for each, and the test that shows the effect (before and after) when the stage allows it |
| **DISMISSED** | Failed a question | The question number and the protection or reason, **with file and line**. Without file and line it is not dismissed, it is unverified |
| **NO CANDIDATES** | The search ran and found nothing | Which search, over which folders. ⚠️ **Not proof of absence**: it is absence of matched patterns |
| **NOT VERIFIED** | Missing tool, access, environment, second account, or time | The name of the gap and what would close it |

🔴 **A stage where everything ended up "not verified" is reported as a failed stage**, not
as a clean report. A green without verification is the defect ProvenSec exists to prevent.

## Severity

Severity comes **after** the verdict, and only for confirmed findings. It follows the
catalog's ruler: how much damage, for how much effort. Two rules:

1. **Say what would change the severity.** "Goes up to critical if the `orders` table also
   has no policy." This keeps the number from looking more certain than it is.
2. **A vulnerable dependency is not reachable by default.** Direct or transitive is what
   you can know. Reachable requires question 1 answered with file and line.

## Found once, searched everywhere

Every CONFIRMED finding triggers a search for variants: the same defect in other routes,
other tables, other forms. Authorization bugs almost never live in one route only. The
variants go through the same three questions.

## Evidence label

| How it was decided | Label |
|---|---|
| By a tool that ran and exited with a code | **MECHANICAL EVIDENCE** |
| By reading code or testing by hand | **WEAK EVIDENCE (manual audit)** |

Both can appear in the same report. Never present the second with the label of the first.
