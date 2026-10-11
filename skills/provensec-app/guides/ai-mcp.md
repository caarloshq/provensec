# AI, agents and MCP: verify authority at the action

Use when retrieved content, model output, persistent memory or MCP tools can affect data access or actions. Methodological reference: Cloudflare security-audit-skill, revision c1c8a8c1471069fb0e188eeaff69b8e8db6564a8. This guide is original text; see [credits](../../../THIRD_PARTY.md).

Follow the existing [verdict](../../provensec/verdict.md) and [deep-audit execution boundary](../../provensec/deep-audit.md). Use dummy identities and bounded local fixtures. A persuasive injected sentence alone is not proof of a security failure. Identify the attacker, affected user, execution identity, resource and unauthorized or unrequested effect.

| Boundary | Inspect and test | Evidence that matters |
|---|---|---|
| Retrieval and conversation isolation | Trace writer permissions, query filters and cache keys for documents, sessions and tenants. Use two dummy tenants to check alternate reads. | A source trace and a bounded result showing one identity receives data it cannot otherwise access. |
| Persistent memory | Follow each memory writer to later consumers. Check provenance and whether external observations become trusted instructions. | An untrusted write changes another user's or a privileged session's action; a shared record with no consumer is insufficient. |
| Tool authority | Follow final tool arguments through the handler to resource authorization. Check the requesting identity independently from the service credential. | The handler permits an operation the requester cannot perform through the normal interface. A broad credential alone is insufficient. |
| Approval and action binding | Compare the intended or approved action with the final tool, arguments, target and amount. Inspect retries, queue execution and resumed sessions. | Arguments can change after approval, or an external input causes an action the affected user did not request. Check idempotency with a bounded duplicate, not real spend. |
| MCP identity and delegation | Check authenticated connection, outstanding request ID, server namespace and delegated capabilities. Treat tool descriptions and returned metadata as untrusted. | A response or tool from a different trust origin is accepted, or a delegated task gains authority outside its assignment. Unknown provider behavior remains not verified. |
| Schemas and dangerous sinks | Trace parsed arguments and model output into filesystem paths, URLs, shell, SQL and rendered content. Compare schema coercion with handler interpretation. | Handler-side validation or encoding fails for a concrete resource or sink. Well-shaped JSON is not authorization. |
| Cost and repeated actions | Inspect per-request limits, cancellation and retry accounting for sends, writes and paid calls. | A tiny local fixture shows repeated effects exceeding the intended request. Never exhaust real quotas to demonstrate it. |

For each candidate record the entry point, transformations, final authority check, effect and counterevidence. Prompts that ask a model to behave safely are not substitutes for deterministic permissions. When a browser, provider or deployment setting determines the outcome, name that missing fact and the owner-observed check needed to resolve it. Do not guess its value.
