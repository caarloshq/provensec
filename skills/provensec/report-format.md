# A report preserves scope, evidence and unresolved work

ProvenSec uses one JSON report for the coverage ledger and candidate decisions.
The format below is an original, deliberately small contract. It complements
[the verdict rule](verdict.md); it does not replace the three verification questions.
See [the example](examples/audit-report.json) for a fictional, structurally valid
report with zero findings. Its evidence is illustrative, not an executed audit.

## Validate the contract

From the repository root:

```sh
node skills/provensec/scripts/validate-report.mjs path/to/report.json
node --test skills/provensec/scripts/validate-report.test.mjs
```

The CLI exits **0** when the contract passes and **1** for invalid JSON, invalid
records, inconsistent references, usage errors or unreadable input. It accepts one
regular UTF-8 JSON file up to 1 MiB, rejects a symlink at the file leaf, opens
nonblocking to avoid FIFO hangs, and limits reads even if the file grows. It never
executes report content or opens evidence paths. Parent-directory symlinks are not
an isolation boundary; use a trusted location for the report input.

The module exports `validateReport(value)`, which returns an array of error strings,
`readReport(filename)`, which reads bounded JSON or throws, and `MAX_BYTES`.
The supported input to `validateReport` is parsed JSON, not arbitrary JavaScript
objects with getters, proxies or cycles. Unknown fields are rejected.

**Contract validation does not prove that a check ran, that a referenced file or line
exists, that an identity is independent, or that the system is secure.** Review the
actual evidence against the stated source revision before issuing a verdict.
A successful validator result is never a security gate on its own.

## Report envelope

| Field | Required value |
|---|---|
| `schema_version` | `"1.0"` |
| `source` | `{ "revision": "<reviewed commit or immutable snapshot>", "dirty": false }`; `dirty` must be boolean |
| `mode` | `"quick"` or `"deep"` |
| `run_status` | `"complete"` or `"incomplete"` |
| `coverage_claim` | Always `"bounded"`; there is no total-security assertion |
| `incomplete_reason` | Nonempty explanation, required only when incomplete and forbidden otherwise |
| `coverage` | Nonempty array of coverage units |
| `findings` | Array of candidate decisions; an empty array is valid |

`source.revision` records the reviewed source, not the date of the report. With a
dirty checkout, set `dirty: true` and identify or retain the actual reviewed snapshot;
a commit alone does not capture uncommitted changes. A new revision requires fresh
evidence review. The validator checks types, not Git history or snapshot contents.

`complete` requires at least one covered in-scope unit and means every included unit has a resolved disposition. It does not mean
all code was inspected or that the application is safe. It rejects any `blocked`,
`deferred` or `candidate` unit and every `not_verified` finding. `planned` is not a
valid status: unfinished planned work must be recorded as deferred, with a reason.
Explicit `out_of_scope` units may coexist with a complete bounded run. Prose must
name these exclusions and describe the run as partial coverage. A quick run is
always a scoped pass. Never derive “secure” or “no vulnerabilities” from an empty
findings array, even when the run is complete.

## Coverage units

Each unit has exactly these fields; `reason` is optional only for covered units:

```json
{
  "id": "auth.session-boundary",
  "scope": "Session verification before protected handler dispatch",
  "paths": ["src/auth"],
  "status": "covered",
  "checks": [{
    "name": "Trace session verification and rejection",
    "evidence": [{
      "path": "src/auth/session.ts",
      "line": 12,
      "statement": "Describe what was observed and how it supports this check."
    }]
  }],
  "finding_ids": []
}
```

Use a stable unit ID for a boundary or review area. IDs are lowercase ASCII letters,
numbers, dots, underscores, colons and hyphens; the first character is alphanumeric,
and the maximum length is 160. IDs must be unique within their collection.

| Status | Meaning and required record |
|---|---|
| `covered` | The stated checks were performed. Requires at least one check with evidence. It can contain confirmed or dismissed decisions, but cannot link `not_verified`; it does not mean safe. |
| `blocked` | A named access, tool or environment gap prevented the check. Requires `reason`. |
| `deferred` | Planned work was not performed. Requires `reason`. |
| `candidate` | A candidate remains unresolved. Requires `reason` and at least one linked `not_verified` decision. |
| `out_of_scope` | An explicit exclusion. Requires `reason`; cannot link findings. |

Every unit requires nonempty `scope` and `paths`, plus `checks` and `finding_ids`
arrays. Noncovered units may have no checks; record any checks actually completed.
Do not convert blocked work to out of scope just to obtain a complete result.

## Evidence and candidate decisions

Every evidence entry is `{ "path": "src/file.ts", "line": 12,
"statement": "What this location establishes" }`. Paths are relative to the
reviewed repository or retained evidence bundle, with `/` separators. Absolute
paths, traversal segments, backslashes and control characters are rejected. Lines
are positive safe integers. Statements are nonempty and must identify the actual
observation, not repeat an unsupported conclusion. Preserve the distinction between
mechanical output and manual source reading described in the verdict rule.

Every finding requires `id`, `root_cause`, nonempty `coverage_ids`, `verdict` and
nonempty `evidence`. Both confirmed issues and dismissed or unverified candidates
live in this array, but prose must separate them. Every relationship is reciprocal:
a unit's `finding_ids` names existing findings, and each finding's `coverage_ids`
names existing units that link back. Duplicate IDs and duplicate root-cause strings
are rejected. The reviewer must also consolidate semantically identical root causes.

`id` identifies the root cause across revisions and verdict changes. For example,
`finding.session-owner` survives a line move or a change from `not_verified` to
`confirmed`. Do not encode line numbers or the current revision into its identity.
`root_cause` states the missing invariant and affected boundary independently of
current locations; evidence holds paths and lines, while `source` holds revision.
The validator cannot prove historical ID stability or semantic equivalence.

| Verdict | Additional required fields | Forbidden fields |
|---|---|---|
| `confirmed` | `severity`: `low`, `medium`, `high` or `critical`; nonempty `observed_result`, `impact` and `remediation` | `reason`, `blocker`, `next_check` |
| `dismissed` | Nonempty `reason`, identifying the failed verdict question or established protection | `severity`, `observed_result`, `impact`, `remediation`, `blocker`, `next_check` |
| `not_verified` | Nonempty `blocker` and `next_check`, naming the decisive gap and the bounded step that would resolve it | `severity`, `observed_result`, `impact`, `remediation`, `reason` |

`observed_result` records the actual bounded observation supporting confirmation. Source-only review must describe the source observation and its limits; never invent runtime execution or an effect that was not observed.

Confirmed evidence must answer production reachability, attacker control and the
search for protections under the verdict rule. A missing deployment fact remains
unverified. A dismissed candidate still needs source evidence; a bare reason is
insufficient. The contract enforces presence and consistency, while the reviewer
checks whether those statements actually support the decision.

## Deep confirmation needs a separate verifier

Every deep confirmed finding must also include:

```json
{
  "discoverer_id": "hunter-1",
  "verification": {
    "verifier_id": "reviewer-1",
    "evidence": [{
      "path": "evidence/session-owner-verification.txt",
      "line": 1,
      "statement": "Describe the independent reread or safely reproduced result."
    }]
  }
}
```

The participant IDs use the stable-ID syntax and must differ. These fields are
optional in quick mode or other verdicts, but if either is supplied, both and the
verification evidence are validated. Distinct strings are only an attestation: the
coordinator must ensure the verifier did not discover the candidate and actually
reviewed current evidence. If no independent verifier is available, retain
`not_verified` and mark the run incomplete. Never invent another identity to pass.

The verifier first tries to refute the candidate. Verification may be source-only
when that supports the bounded claim; runtime claims need actual runtime evidence.
JSON validity authorizes no execution, deployment contact or mutation. Any execution
must independently satisfy the workflow's explicit safety and authorization rules.
