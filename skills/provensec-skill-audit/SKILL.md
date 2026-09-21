---
name: provensec-skill-audit
description: 'Audits a third-party skill, plugin or agent package BEFORE it is installed. Mechanically lists suspicious lines (hidden instructions to the agent, reading credentials, sending data out, download-and-execute, admin privileges, touching agent settings or hooks, scheduled persistence, compiled files) and decides each by hand with ProvenSec''s verdict rule. Runs offline, no Python, sends nothing anywhere. Use when asked to download, install, vendor or evaluate a third-party skill, plugin or MCP, or "is this skill safe?", "should I install this?". Not for an app''s code: that is provensec-app.'
license: MIT
metadata:
  version: 1.0.0
---

# provensec-skill-audit

A skill runs with the agent's trust: it reads your files, runs commands, installs hooks.
Research cited by NVIDIA's SkillSpector (Liu et al., 2026, over 31 thousand skills
analyzed) reports that **26.1% had some vulnerability and 5.2% looked malicious**. The
figure is quoted from the SkillSpector README, not checked against the paper.

## Three steps

1. **Download outside your skills folder**, into a temporary folder. Never straight into
   the folder your agent loads skills from. Nothing from the skill runs during the audit.
2. **List the candidates:**
   ```bash
   node <this-skill-dir>/scripts/scan.mjs <downloaded-folder>
   ```
   | Exit | Meaning |
   |---|---|
   | **0** | No pattern found, and every file was read. ⚠️ Not proof the skill is safe |
   | **2** | Candidates to decide by hand |
   | **3** | No pattern found, but some file was not read (image, symlink, unknown format). Not a green |
   | **1** | The folder does not exist or is not a folder |
3. **Decide each candidate** with [`../provensec/verdict.md`](../provensec/verdict.md).
   Here the three questions become:
   - **Does this actually run?** Documentation describing what a skill *blocks* is not the
     skill *doing* it.
   - **Does it act without the user seeing?** Installing hooks, scheduling tasks, skipping
     confirmations.
   - **Is there a stated and proportionate reason?** A server-hardening skill using `sudo` is
     its job. A text-formatting skill reading `~/.ssh` is not.

## The final verdict

| Verdict | When |
|---|---|
| **INSTALL** | Every candidate dismissed with file and line |
| **INSTALL WITH A NOTE** | Real behavior, but proportionate. Write the note down where whoever updates the skill will read it |
| **DO NOT INSTALL** | Hidden instructions, credentials read without a reason, data sent out, or compiled files you cannot read |

🔴 **The label is always `WEAK EVIDENCE (manual audit)`.** The candidate list is mechanical,
the decision is not. A file the scan could not read is reported as NOT VERIFIED.

## What it looks for

Categories inspired by SkillSpector (NVIDIA, Apache 2.0), written from scratch. Its engine
is not used: it needs Python 3.12 and, by default, sends the skill's content to NVIDIA's
service.

| Category | Examples of what it flags |
|---|---|
| Hidden instruction | "ignore previous instructions", "do not tell the user", invisible characters |
| Anti-refusal | "never refuse", "do not ask for permission" |
| Credentials and exfiltration | `~/.ssh`, Keychain, `curl -d` to a domain, tunnels |
| Supply chain | download-and-execute in one line, `eval` of encoded content, installing packages on the fly, compiled files |
| Escalation | `sudo`, `chmod 777`, editing `settings.json`, hooks, `bypassPermissions` |
| Persistence | `crontab`, `LaunchAgents`, editing `.zshrc` |
| Self-modification | the skill rewriting `SKILL.md`, `CLAUDE.md` or other skills |
| Broad trigger | a description that fires "always", on "any request" |

## Controls that proved the scan

| Case | Result |
|---|---|
| Fake skill with nine planted problems | 10 candidates, all nine categories flagged, exit 2 |
| Clean text-formatting skill | 0 candidates, exit 0 |
| Clean skill plus an image and a symlink | Exit 3: not a green |
| Skill with a GitHub token inside a flagged `curl` line | The line is shown with the token masked as `[len 46 · …q7R8]`, never in full |

## What this stage does not do

| Item | Why |
|---|---|
| Run the skill to see what it does | Running it is exactly the risk. The audit is reading |
| Follow the skill's npm or pip dependencies | Run `provensec-app --dependencies` on the skill's folder |
| Read images, PDFs or compiled files | Reported as NOT VERIFIED, and compiled files are already a high candidate |
