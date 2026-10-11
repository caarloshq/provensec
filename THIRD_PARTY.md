# Third-party material

ProvenSec runs no third-party code. It uses ideas and adapted text from the projects below.

| Project | License | What ProvenSec uses | Where |
|---|---|---|---|
| [Strix](https://github.com/usestrix/strix) | Apache 2.0 | Two testing guides, translated and condensed (IDOR, function-level authorization), each with attribution at the top; links to five more of its guides from the catalog; the three-state closure from `analysis/counterevidence.md` | `skills/provensec-app/guides/`, `skills/provensec/verdict.md` |
| [VibeSec-Skill](https://github.com/BehiSecc/VibeSec-Skill) | Apache 2.0 | The vulnerability classes the catalog lacked: SSRF, open redirect, path traversal, JWT, CSRF, GraphQL | `skills/provensec/catalog.md`, A35 to A41 |
| [Trail of Bits skills](https://github.com/trailofbits/skills) | CC BY-SA 4.0 | Ideas only, **rewritten without copying text**: refutation-first candidate review, four explicit report states, insecure-defaults checks | `skills/provensec/verdict.md`, `skills/provensec-app/scripts/rules.mjs` |
| [SkillSpector](https://github.com/NVIDIA/SkillSpector) | Apache 2.0 | The categories of what to look for in a third-party skill, written from scratch. The 26.1% / 5.2% figures are quoted from its README | `skills/provensec-skill-audit/` |
| [onp-security-vps](https://www.npmjs.com/package/@onovoprogramador/onp-security-vps), Vitor Manoel | MIT | Not included. Recommended for the server track | `skills/provensec/SKILL.md` |

## Cloudflare methodological reference

The coverage-led workflow, independent verification, stable finding identities and AI/MCP review topics draw on [Cloudflare security-audit-skill](https://github.com/cloudflare/security-audit-skill), MIT, revision `c1c8a8c1471069fb0e188eeaff69b8e8db6564a8` reviewed on 2026-10-11. ProvenSec's added prose, report format, validator and tests are original implementations; upstream scripts and schema are not bundled. The original source's copyright is Cloudflare, Inc., 2025–2026. Any future substantial copy must retain the upstream MIT notice.

## Apache 2.0 notice for the Strix-derived guides

The files `skills/provensec-app/guides/idor.md` and
`skills/provensec-app/guides/function-level-authorization.md` are adapted from Strix
(https://github.com/usestrix/strix), Copyright its contributors, licensed under the
Apache License, Version 2.0 (https://www.apache.org/licenses/LICENSE-2.0). They were
translated, condensed and modified. Changes are not endorsed by the original authors.
