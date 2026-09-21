#!/usr/bin/env node
// Run before every push. Exit 0 = safe to publish. Exit 1 = something must be fixed first.
// 1. No private names, client names or machine paths in the tree.
// 2. ProvenSec scanned by itself: zero leaked-secret candidates.
// 3. Every rule test passes.
// 4. Every relative markdown link resolves.
// 5. Skill frontmatter is strict YAML.
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKIP = new Set(['.git', 'node_modules'])
const problems = []

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (SKIP.has(n)) continue
    const p = join(dir, n)
    statSync(p).isDirectory() ? walk(p, out) : out.push(p)
  }
  return out
}
const files = walk(ROOT)
const self = fileURLToPath(import.meta.url)

// 1. Private references. Add any name that must never be published.
const PRIVATE = /\/Users\/|AI-Workspace|Telecarga|Tele Carga|AmFi|job-scrapper|caca-vagas|shield-app|shield-vps|shield-skill|_veredito|_catalogo|SF3e|9d4313f6/i
for (const f of files) {
  if (f === self) continue
  const text = readFileSync(f, 'utf-8')
  text.split('\n').forEach((line, i) => {
    if (PRIVATE.test(line)) problems.push(`private reference · ${relative(ROOT, f)}:${i + 1}`)
  })
}

// 2. Self-scan for secrets.
try {
  const out = execFileSync('node', [join(ROOT, 'skills/provensec-app/scripts/provensec-app.mjs'), '--dir', ROOT, '--json'], { stdio: ['ignore', 'pipe', 'ignore'] }).toString()
  report(out)
} catch (e) { report(e.stdout?.toString() ?? '') }
function report(out) {
  let d
  try { d = JSON.parse(out) } catch { problems.push('self-scan did not return JSON'); return }
  const secrets = d.stages.find(s => s.covers.includes('A05') && s.name.startsWith('Secrets'))
  if (!secrets || secrets.status !== 'ran') problems.push(`self-scan secrets stage did not run (${secrets?.status})`)
  for (const f of secrets?.findings ?? []) problems.push(`secret candidate · ${f.where} · ${f.rule}`)
}

// 3. Rule tests.
try { execFileSync('node', [join(ROOT, 'skills/provensec-app/scripts/rules.test.mjs')], { stdio: 'pipe' }) }
catch (e) { problems.push(`rule tests failed:\n${e.stdout}`) }

// 5. Skill frontmatter must be strict YAML: an unquoted description with ": " breaks
//    installers like `npx skills`, even though Claude Code tolerates it.
for (const f of files.filter(f => f.endsWith('SKILL.md'))) {
  const m = readFileSync(f, 'utf-8').match(/^description: (.*)$/m)
  if (!m) { problems.push(`no description · ${relative(ROOT, f)}`); continue }
  const d = m[1]
  if (!/^['"]/.test(d) && /: |#\s/.test(d)) problems.push(`unquoted description with ": " breaks YAML · ${relative(ROOT, f)}`)
}

// 4. Relative links.
for (const f of files.filter(f => f.endsWith('.md'))) {
  for (const m of readFileSync(f, 'utf-8').matchAll(/\]\(([^)#\s]+)\)/g)) {
    const link = m[1]
    if (/^(https?:|mailto:)/.test(link)) continue
    if (!existsSync(join(dirname(f), link))) problems.push(`broken link · ${relative(ROOT, f)} → ${link}`)
  }
}

if (problems.length) {
  console.log(`NOT READY TO PUBLISH · ${problems.length} problem(s)\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`Ready to publish · ${files.length} files checked · no private references · no secret candidates · rule tests pass · links resolve`)
