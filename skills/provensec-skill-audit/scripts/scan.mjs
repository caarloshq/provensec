#!/usr/bin/env node
// provensec-skill-audit: lists CANDIDATES in a third-party skill before it is installed.
// It gives no verdict. Every line it prints goes through ../../provensec/verdict.md.
// Categories inspired by SkillSpector (NVIDIA, Apache 2.0), written from scratch,
// without its engine: runs offline, no Python, sends nothing anywhere.
//
// Usage: node scan.mjs <skill-folder> [--json]
// Exit: 0 no candidates and every file read · 2 candidates found · 3 no candidates but
// some file could not be read (NOT a green) · 1 invalid folder

import { readdirSync, readFileSync, statSync, lstatSync, existsSync } from 'node:fs'
import { join, relative, extname } from 'node:path'

const [target, ...rest] = process.argv.slice(2)
const JSON_OUT = rest.includes('--json')
if (!target || !existsSync(target) || !statSync(target).isDirectory()) {
  console.error('usage: node scan.mjs <skill-folder> [--json]')
  process.exit(1)
}

// [category, severity, what it means, regex]
const RULES = [
  ['hidden-instruction', 'high', 'Text that tries to change the agent\'s rules', /\b(ignore|disregard|forget)\b.{0,40}\b(previous|prior|above|all)\b.{0,20}\b(instructions?|rules?)\b|ignore (as )?(instru|regras) anteriores/i],
  ['hidden-instruction', 'high', 'Asks to hide from the user what was done', /\b(do not|don't|never)\s+(tell|inform)\s+the\s+user\b|\bwithout the user (knowing|noticing)\b|sem (que )?o usuário (saber|perceber)|não (conte|avise) (ao|o) usuário/i],
  ['hidden-instruction', 'warning', 'Invisible character in the text', /[​-‏‪-‮⁠-⁤﻿]/],
  ['anti-refusal', 'high', 'Tries to stop the agent from refusing', /\b(never|do not|don't)\s+refuse\b|\bnunca recuse\b|\b(do not|don't|never)\s+ask (for )?(permission|confirmation)\b/i],
  ['exfiltration', 'high', 'Reads credentials or sensitive folders on the machine', /~\/\.ssh|id_rsa|id_ed25519|\.aws\/credentials|\.netrc|Keychain|security find-(generic|internet)-password|\.claude\/\.credentials/i],
  ['exfiltration', 'warning', 'Sends data over the network', /\bcurl\b[^\n]*\s(-d|--data|-F|-T|--upload-file)\b|\bwget\b[^\n]*--post|fetch\([^)]*method:\s*['"]POST|\bnc\s+-|webhook\.site|ngrok|requestbin|pipedream/i],
  ['supply-chain', 'high', 'Downloads and executes in one line', /(curl|wget)[^\n|]*\|\s*(ba|z)?sh\b|iex\s*\(|Invoke-Expression/i],
  ['supply-chain', 'warning', 'Encoded content turned into code', /base64\s+(-d|--decode)[^\n]*\|\s*(ba|z)?sh|\beval\(\s*(atob|Buffer\.from)|\beval\([^)]*\)|new Function\(|exec\(\s*compile/i],
  ['supply-chain', 'warning', 'Installs a package on the fly', /\b(npm|pnpm|yarn)\s+(i|install|add)\b|\bnpx\s+-y\b|\bpip3?\s+install\b|\buv\s+(tool\s+)?install\b|\bbrew\s+install\b/i],
  ['escalation', 'high', 'Asks for admin privileges', /\bsudo\b|chmod\s+(-R\s+)?777|chown\s+root/i],
  ['escalation', 'high', 'Touches agent settings or hooks', /settings(\.local)?\.json|hooks\.json|PreToolUse|PostToolUse|SessionStart|UserPromptSubmit|dangerously|bypassPermissions|--no-verify/i],
  ['persistence', 'high', 'Schedules something that outlives the session', /\bcrontab\b|LaunchAgents|launchctl\s+(load|bootstrap)|systemctl\s+enable|(~|\$HOME)\/\.(bashrc|zshrc|bash_profile|profile)\b/i],
  ['self-modification', 'warning', 'The skill rewrites itself or other skills', /(SKILL\.md|\.claude\/skills|CLAUDE\.md|AGENTS\.md)[^\n]{0,60}\b(write|overwrite|append|edit|escrev|sobrescrev)/i],
  ['broad-trigger', 'warning', 'Description that triggers on any request', /^description:.*\b(always|any request|every task|all tasks|sempre que|qualquer pedido)\b/im],
]

const IGNORE = new Set(['.git', 'node_modules', '.venv', '__pycache__'])
const TEXT_EXT = new Set(['.md', '.mdx', '.txt', '.json', '.yml', '.yaml', '.js', '.mjs', '.cjs', '.ts', '.py', '.sh', '.bash', '.zsh', '.toml', '.tsx', '.jsx', '.mts', '.cts', '.rb', '.go', '.php', '.ps1', '.lua', ''])
const SUSPICIOUS_BINARY = new Set(['.pyc', '.so', '.dylib', '.exe', '.bin', '.wasm', '.node'])

// A key inside a flagged line must not be printed. Any long token-shaped run becomes a hint.
const mask = (t) => t.replace(/[A-Za-z0-9_\-+/=.]{20,}/g, (v) => /^[a-z]+(?:[\/.-][a-z]+)*$/i.test(v) ? v : `[len ${v.length} · …${v.slice(-4)}]`)

const candidates = []
const gaps = []
let read = 0

function walk(dir) {
  let names
  try { names = readdirSync(dir) } catch { gaps.push(`${relative(target, dir) || '.'} (folder could not be opened)`); return }
  for (const nome of names) {
    if (IGNORE.has(nome)) continue
    const p = join(dir, nome)
    // Symlinks are not followed: they can point outside the skill or loop.
    if (lstatSync(p).isSymbolicLink()) { gaps.push(`${relative(target, p)} (symlink, not followed)`); continue }
    const st = statSync(p)
    if (st.isDirectory()) { walk(p); continue }
    const ext = extname(nome).toLowerCase()
    const rel = relative(target, p)
    if (SUSPICIOUS_BINARY.has(ext)) {
      candidates.push({ category: 'supply-chain', severity: 'high', says: 'Compiled file that cannot be read', where: rel })
      continue
    }
    if (!TEXT_EXT.has(ext)) { gaps.push(rel); continue }
    if (st.size > 2_000_000) { gaps.push(`${rel} (larger than 2 MB)`); continue }
    read++
    const lines = readFileSync(p, 'utf-8').split('\n')
    lines.forEach((l, i) => {
      for (const [category, severity, says, re] of RULES) {
        if (re.test(l)) candidates.push({ category, severity, says, where: `${rel}:${i + 1}`, excerpt: mask(l.trim()).slice(0, 140) })
      }
    })
  }
}
walk(target)

if (JSON_OUT) {
  console.log(JSON.stringify({ target, read, candidates, gaps }, null, 2))
} else {
  console.log(`provensec · skill audit  ${target}`)
  console.log(`${read} text files read · ${candidates.length} candidates · ${gaps.length} files not read\n`)
  const order = { high: 0, warning: 1 }
  for (const c of candidates.sort((a, b) => order[a.severity] - order[b.severity])) {
    console.log(`  ${c.severity.toUpperCase().padEnd(7)} ${c.says}\n          ${c.where}${c.excerpt ? `  ${c.excerpt}` : ''}`)
  }
  if (gaps.length) console.log(`\nNot read (reported as NOT VERIFIED):\n  ${gaps.slice(0, 20).join('\n  ')}${gaps.length > 20 ? `\n  … and ${gaps.length - 20} more` : ''}`)
  console.log(`\nThis is a candidate list, not a verdict. Every candidate goes through verdict.md.`)
  if (!candidates.length) console.log('No candidates is not proof of absence: it is absence of matched patterns.')
  if (!candidates.length && gaps.length) console.log('Some files were not read. This is NOT a green.')
}
process.exit(candidates.length ? 2 : gaps.length ? 3 : 0)
