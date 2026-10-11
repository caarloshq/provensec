# ProvenSec

**Security checks for people building with AI.**

I'm a product designer building with AI coding agents. I wanted a clearer way to review what I build: what was checked, what needs attention, and what still needs proof.

ProvenSec brings together ideas from existing security skills and guides, adapted instructions, and original checks in one skill. It gives the agent a review process with a simple rule: **anything that was not verified stays unverified.**

## What it helps you check

- **Your app:** exposed keys, risky code patterns, access permissions and other security concerns.
- **Third-party skills:** what they ask the agent to read, run or send before you install them.
- **AI features and tools:** how they handle memory, user data, permissions and approved actions.

Local scanners flag things to investigate. The agent checks the context and reports the evidence and gaps. For a deeper review, a separate agent verifies proposed findings.

## Built from shared knowledge

The work is in selecting, adapting and connecting these sources into a focused workflow:

| Source | What it contributed |
|---|---|
| [Strix](https://github.com/usestrix/strix) | Application testing guides and explicit verification states |
| [Trail of Bits](https://github.com/trailofbits/skills) | Ideas for challenging suspected issues before treating them as findings |
| [VibeSec](https://github.com/BehiSecc/VibeSec-Skill) | Additional application security checks |
| [NVIDIA SkillSpector](https://github.com/NVIDIA/SkillSpector) | Categories for examining third-party skills |
| [Cloudflare](https://github.com/cloudflare/security-audit-skill) | Coverage tracking, independent verification and AI security review methods |

ProvenSec adds local scanners, a report validator and a shared decision process. The original tools are not installed as dependencies. [Attribution and licenses](THIRD_PARTY.md) explain what was adapted and what was written for this project.

## Use it

```bash
npx skills add caarloshq/provensec
```

Then ask your coding agent:

> Review the security of this app. Show what you checked, what you found and what remains unverified.

You can also ask it to check a skill before installation or perform a deeper audit. The scanners need Node.js and Git; agent-assisted review uses your configured AI runtime.

## Know the limits

ProvenSec can miss issues and flag code that is safe. It helps organize security review; it does not certify that a product is secure or replace a specialist assessment.

The scanners run locally. Optional dependency checks contact the npm registry only when requested. Agent reasoning follows the data policy of your AI runtime.

[Checks and scope](skills/provensec/SKILL.md) · [Deep audits](skills/provensec/deep-audit.md) · [Report format](skills/provensec/report-format.md) · [Run the scanner](skills/provensec-app/SKILL.md)

MIT. Adapted Strix guides retain Apache 2.0. See [LICENSE](LICENSE) and [third-party notices](THIRD_PARTY.md).
