# Evidence-led audits

Date: 2026-10-11

## Authorized scope

The owner approved all five incorporation recommendations from the Cloudflare review, plus the partial-history success fix. Preserve the quick scanner; add an opt-in deep workflow. No installation of upstream code, commit or publication is included.

## Acceptance criteria

1. Coverage records distinguish examined, blocked, deferred and excluded areas; incomplete coverage cannot masquerade as a complete run.
2. A zero-dependency validator enforces verdict evidence, cross-references and deep-review independence. Its success means a valid report contract, never proven security.
3. Deep review requires a distinct verifier for each confirmed finding, explicit budget handling and safe execution boundaries.
4. Stable finding identities survive line changes; source changes require revalidation.
5. An AI/MCP guide covers retrieval, memory, tool authority, action binding and output handling with observable checks.
6. Partial Git history produces exit 1 without high/critical candidates; full history and existing severity behavior have regression coverage.
7. Public documentation, attribution, examples and project checks reflect the new behavior.

## Plan

- Add report contract, validator, example and rejection tests.
- Add deep audit instructions and route to them from existing skills.
- Add AI/MCP guide and link it from the app track.
- Fix scanner coverage behavior and add CLI integration tests.
- Update README, credits and public checks; run focused tests and review.

## Decisions

The implementation extends the existing skills. Cloudflare is a methodological reference, not an installed dependency. Reports retain source revision and dirty state; a historical verdict is not current evidence. Runtime checks require enforced isolation; unavailable isolation remains a named gap. Scanner candidate priority remains distinct from final finding severity.

## Verification

Completed on 2026-10-11.

- Report and scanner regression suites: 22 tests passed, 0 failed.
- Existing rule suite: 70 cases, 0 failures, no rule without a case.
- Synthetic report example: valid contract; evidence authenticity is explicitly not asserted.
- Public gate: passed secret scan, private-reference check, tests and relative links.
- Independent source review found and resolved documentation scope/provenance contradictions, gate initialization ordering and malformed JSON ID handling.
- Diff whitespace check passed.

All seven acceptance criteria are implemented. Deep auditing and historical comparison are agent workflows, not a new autonomous runner. No full audit of a real target was performed; no sandbox implementation is bundled. No upstream scripts or schema were copied, and no commit or publication was performed.

Workspace-wide spec-link check returned exit 1 for unrelated references outside this project; no ProvenSec entry was reported. The project-specific public link check passed.

## Follow-up review, 2026-10-11

Two P2 findings were fixed within the approved scope:

- CLI entry detection skipped validation when invoked through a script symlink. Resolve both module and entrypoint identities; regression covers default resolution, preserved main symlinks, invalid reports and stdin imports.
- The deep workflow required a sandbox even for a fully source-supported claim. Sandbox absence now blocks only decisive checks requiring target-code execution; independent source-only claims remain bounded and explicitly non-runtime.

Verification after these fixes: 23 report/history tests passed, 70 rule cases passed, public gate passed, and no whitespace errors. Review did not audit a deployed target or establish runtime sandbox availability. No commit or publication.

## Local presentation and closure, 2026-10-11

The owner approved a shorter English README centered on the designer's motivation, source contributions, basic usage and honest limits, then requested fix-all. Technical instructions remain in existing skill guides. The attribution wording now matches the unconfirmed-first candidate state. README publication remains pending owner validation of the local version. Fix-all authorizes a scoped local commit, not a push.
