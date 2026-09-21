#!/usr/bin/env node
// ProvenSec app scan: secrets, code patterns and (optionally) dependencies.
// Zero dependencies: only Node and git. Nothing is installed, nothing leaves the machine.
// The trade-off is precision: this is text pattern matching, line by line, not a parser.
// The report says so: every hit is a CANDIDATE, not a finding.
//
// The rule that governs everything here: a stage that did not run NEVER shows as green.
// Silence from a tool that did not run looks exactly like silence from a clean project.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, lstatSync } from 'node:fs'
import { join, relative, extname, basename } from 'node:path'
import { SECRETS, CODE, looksSecret } from './rules.mjs'

const ARGS = process.argv.slice(2)
const flag = (n) => ARGS.includes(`--${n}`)
const option = (n, d) => { const i = ARGS.indexOf(`--${n}`); return i >= 0 && ARGS[i+1] ? ARGS[i+1] : d }
const DIR = option('dir', process.cwd())
const JSON_OUT = flag('json')
const FULL = flag('full-history')
const MAX_COMMITS = Number(option('commits', '400'))
const DEPENDENCIES = flag('dependencies')

const C = process.stdout.isTTY && !JSON_OUT
  ? { r:'\x1b[31m', a:'\x1b[33m', v:'\x1b[32m', c:'\x1b[36m', d:'\x1b[2m', n:'\x1b[0m', b:'\x1b[1m' }
  : { r:'', a:'', v:'', c:'', d:'', n:'', b:'' }

function run(cmd, args, opts = {}) {
  try { return { ok: true, saida: execFileSync(cmd, args, { cwd: DIR, stdio: 'pipe', timeout: opts.timeout ?? 600000, maxBuffer: 512*1024*1024 }).toString() } }
  catch (e) { return { ok: false, saida: (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? ''), codigo: e.status } }
}
/** Only the hint, never the value. `len 46 · …a1b2` */
const hint = (s) => !s ? 'sem option' : (s.length <= 6 ? `len ${s.length}` : `len ${s.length} · …${s.slice(-4)}`)

const SKIP_DIRS = new Set(['node_modules', '.git', '.next', 'dist', 'build', '.venv', 'venv', '__pycache__', '.turbo', '.vercel', 'coverage', '.svelte-kit', '.nuxt', '.output'])
const CODE_EXT = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.mts', '.cts', '.vue', '.svelte', '.astro'])
const MAX_BYTES = Number(option('max-file-mb', '1')) * 1024 * 1024

// ---------------------------------------------------------------------- recon
function recon() {
  const p = {
    dir: DIR,
    git: !run('git', ['rev-parse', '--is-inside-work-tree']).ok ? false : true,
    npm: existsSync(join(DIR, 'package.json')),
    lock: existsSync(join(DIR, 'package-lock.json')),
    commits: 0, files: [],
  }
  if (p.git) {
    // `-- .` limits history to the requested folder: running in a subfolder of a
    // big repo scans that folder's history, not the whole repository's.
    const r = run('git', ['rev-list', '--count', '--all', '--', '.'])
    p.commits = r.ok ? Number(r.saida.trim()) : 0
    const f = run('git', ['ls-files', '-co', '--exclude-standard'])
    p.files = f.ok ? f.saida.split('\n').filter(Boolean) : []
  } else {
    p.files = walk(DIR)
  }
  return p
}
function walk(dir, list = []) {
  let names
  try { names = readdirSync(dir) } catch { return list }
  for (const name of names) {
    if (SKIP_DIRS.has(name)) continue
    const p = join(dir, name)
    if (lstatSync(p).isSymbolicLink()) continue
    if (statSync(p).isDirectory()) walk(p, list)
    else list.push(relative(DIR, p))
  }
  return list
}
function readText(rel) {
  const p = join(DIR, rel)
  try {
    const st = statSync(p)
    if (!st.isFile() || st.size > MAX_BYTES) return null
    const t = readFileSync(p, 'utf-8')
    return t.includes('\u0000') ? null : t     // binary
  } catch { return null }
}
const inSkippedDir = (rel) => rel.split('/').some(s => SKIP_DIRS.has(s))

function matchSecrets(line, where, extra = {}) {
  const findings = []
  for (const r of SECRETS) {
    r.re.lastIndex = 0
    let m
    while ((m = r.re.exec(line))) {
      const found = m[r.group ?? 0]
      if (!looksSecret(found, r)) continue
      findings.push({ severity: r.severity, rule: r.id, says: r.says, where, hint: hint(found), ...extra })
      if (!r.re.global) break
    }
  }
  return findings
}

// ------------------------------------------------------------------ secrets stage
function secretsStage(p) {
  const e = { name: 'Secrets on disk and in history', covers: 'A02, A05', findings: [] }

  // 1. What is on disk now, tracked or not (except what .gitignore hides).
  let read = 0
  for (const rel of p.files) {
    if (inSkippedDir(rel)) continue
    const name = basename(rel)
    if (p.git && /^\.env(\..+)?$/.test(name) && !/\.(example|sample|template)$/.test(name)) {
      const tracked = run('git', ['ls-files', '--error-unmatch', rel]).ok
      if (tracked) e.findings.push({ severity: 'high', rule: 'env-file-tracked', says: 'Environment file tracked by git: .gitignore does not undo what was already committed', where: rel })
    }
    const t = readText(rel)
    if (t === null) continue
    read++
    t.split('\n').forEach((l, i) => e.findings.push(...matchSecrets(l, `${rel}:${i + 1}`)))
  }

  // 2. History. What left the disk is still in git, and that is where leaks live.
  if (!p.git) {
    return { ...e, status: 'partial', scope: `${read} files on disk`, reason: 'the folder is not a git repository: history was NOT scanned' }
  }
  if (p.commits === 0) {
    return { ...e, status: 'ran', scope: `${read} files on disk · no commits yet` }
  }
  const capped = !FULL && p.commits > MAX_COMMITS
  // --relative: paths relative to the requested folder, same as the disk scan.
  const args = ['log', '--all', '-p', '-U0', '--relative', '--no-color', '--no-ext-diff', '--format=@@commit %H']
  if (capped) args.push(`-n`, String(MAX_COMMITS))
  args.push('--', '.')
  const r = run('git', args, { timeout: 900000 })
  if (!r.ok) {
    return { ...e, status: 'failed', reason: `git log failed: ${(r.saida || '').slice(-160).trim() || 'no output'}. History was NOT scanned` }
  }
  let commit = '', file = '', newLine = 0
  const seen = new Set(e.findings.map(a => `${a.rule}|${a.hint}`))
  for (const l of r.saida.split('\n')) {
    if (l.startsWith('@@commit ')) { commit = l.slice(9, 17); continue }
    if (l.startsWith('+++ ')) { file = l.slice(4).replace(/^b\//, ''); continue }
    if (l.startsWith('@@ ')) { const m = l.match(/\+(\d+)/); newLine = m ? Number(m[1]) : 0; continue }
    if (!l.startsWith('+') || l.startsWith('+++')) continue
    if (inSkippedDir(file)) { newLine++; continue }
    for (const a of matchSecrets(l.slice(1), `${file}:${newLine}`, { commit })) {
      // The same value on disk and in history is one candidate, not two.
      const k = `${a.rule}|${a.hint}`
      if (seen.has(k)) continue
      seen.add(k)
      e.findings.push({ ...a, says: `${a.says}. It is in git history: rotate it, deleting the file is not enough` })
    }
    newLine++
  }
  const scope = `${read} files on disk · ${capped ? `${MAX_COMMITS} of ${p.commits}` : p.commits} commits`
  return { ...e, status: 'ran', scope, partial: capped }
}

// ---------------------------------------------------------------------- code stage
function codeStage(p) {
  const e = { name: 'Dangerous and insecure code', covers: 'A02, A05, A11, A12, A14, A24, A27, A29, A38', findings: [] }
  let read = 0
  for (const rel of p.files) {
    if (inSkippedDir(rel) || !CODE_EXT.has(extname(rel).toLowerCase()) && !/next\.config\./.test(rel)) continue
    if (/\.min\.(js|mjs)$/.test(rel)) continue
    const t = readText(rel)
    if (t === null) continue
    read++
    const isClient = /^\s*['"]use client['"]/m.test(t)
    t.split('\n').forEach((l, i) => {
      const s = l.trim()
      if (s.startsWith('//') || s.startsWith('*') || s.startsWith('/*')) return
      for (const r of CODE) {
        if (r.clientOnly && !isClient) continue
        if (!r.re.test(l)) continue
        if (r.except && r.except.test(l)) continue
        e.findings.push({ severity: r.severity, rule: r.id, says: r.says, where: `${rel}:${i + 1}` })
      }
    })
  }
  if (read === 0) return { ...e, status: 'ran', scope: 'no JavaScript or TypeScript files found' }
  return { ...e, status: 'ran', scope: `${read} code files · text pattern matching, not parsing` }
}

// ---------------------------------------------------------------- deps stage
function depsStage(p) {
  const e = { name: 'Vulnerable dependencies', covers: 'A28', findings: [] }
  if (!DEPENDENCIES) return { ...e, status: 'not-requested', reason: 'not requested. It sends your package list and versions to the npm registry', fix: 'run with --dependencies' }
  if (!p.npm) return { ...e, status: 'did-not-run', reason: 'no package.json: no ecosystem to audit' }
  if (!p.lock) return { ...e, status: 'did-not-run', reason: 'package.json without package-lock.json: without a lockfile the audit cannot know installed versions' }

  const r = run('npm', ['audit', '--json'], { timeout: 300000 })
  let d = {}
  try { d = JSON.parse(r.saida) } catch { return { ...e, status: 'failed', reason: 'npm audit returned unreadable JSON (offline?)' } }
  if (d.error) return { ...e, status: 'failed', reason: `npm audit: ${String(d.error.summary || d.error.code || 'erro').slice(0, 120)}` }
  const vs = d.vulnerabilities || {}
  const map = { critical: 'critical', high: 'high', moderate: 'warning', low: 'info', info: 'info' }
  e.findings = Object.entries(vs).map(([name, v]) => ({
    severity: map[v.severity] || 'warning',
    rule: 'vulnerable-dependency',
    where: name,
    // npm audit does not know reachability. Direct vs transitive is the honest proxy.
    reach: v.isDirect ? 'direct dependency' : 'transitive, your code may never call it',
  }))
  const m = d.metadata?.vulnerabilities || {}
  return { ...e, status: 'ran', scope: `${d.metadata?.dependencies?.total ?? '?'} packages`,
           summary: `${m.critical||0} critical · ${m.high||0} high · ${m.moderate||0} moderate · ${m.low||0} low` }
}

// ---------------------------------------------------------------------- output
const ORDER = { critical: 0, high: 1, warning: 2, info: 3 }
const LABEL = { critical: `${C.r}CRITICAL${C.n}`, high: `${C.r}HIGH${C.n}`, warning: `${C.a}WARNING${C.n}`, info: `${C.d}INFO${C.n}` }

function report(p, stages) {
  const map = new Map()
  for (const e of stages) for (const a of (e.findings || [])) {
    const k = `${a.rule}|${a.where}`
    if (map.has(k)) map.get(k).times++
    else map.set(k, { ...a, stage: e.name, times: 1 })
  }
  const all = [...map.values()]
  all.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || a.where.localeCompare(b.where))
  const count = (g) => all.filter(a => a.severity === g).length
  const gaps = stages.filter(e => !['ran', 'not-requested'].includes(e.status))

  if (JSON_OUT) {
    console.log(JSON.stringify({ project: { ...p, files: p.files.length }, stages, findings: all }, null, 2))
  } else {
    console.log(`${C.b}provensec · app scan${C.n}  ${C.d}${p.dir}${C.n}`)
    console.log(`${C.d}${p.commits} commits · ${p.files.length} files · Node and git only, nothing leaves this machine${DEPENDENCIES ? ' (except the npm audit you asked for)' : ''}${C.n}\n`)

    console.log(`${C.b}Coverage${C.n}`)
    for (const e of stages) {
      const mark = e.status === 'ran' ? `${C.v}✔${C.n}` : e.status === 'not-requested' ? `${C.d}–${C.n}` : `${C.r}❌${C.n}`
      const tail = e.status === 'ran'
        ? `${C.d}${e.scope}${e.partial ? ' · PARCIAL' : ''}${C.n}`
        : `${e.status === 'not-requested' ? C.d : C.r}${e.scope ? e.scope + ' · ' : ''}${e.reason}${C.n}${e.fix ? `  ${C.c}→ ${e.fix}${C.n}` : ''}`
      console.log(`  ${mark} ${e.name.padEnd(34)} ${tail}`)
    }

    if (all.length) {
      console.log(`\n${C.b}Candidates${C.n} ${C.d}(each goes through verdict.md before it becomes a finding)${C.n}`)
      for (const a of all.slice(0, 60)) {
        console.log(`  ${LABEL[a.severity]}  ${a.says || a.rule}${a.times > 1 ? ` ${C.d}×${a.times}${C.n}` : ''}`)
        console.log(`        ${C.d}${a.where}${a.commit ? ` · commit ${a.commit}` : ''}${a.hint ? ` · ${a.hint}` : ''}${C.n}`)
        if (a.reach) console.log(`        ${a.reach}`)
      }
      if (all.length > 60) console.log(`  ${C.d}… and ${all.length - 60} more${C.n}`)
    }

    console.log(`\n${C.b}Verdict${C.n}`)
    console.log(`  ${count('critical')} critical · ${count('high')} high · ${count('warning')} warning · ${count('info')} info`)
    if (gaps.length) console.log(`  ${C.r}${gaps.length} stage(s) did not fully run. This is NOT a green.${C.n}`)
    if (stages.some(e => e.partial)) console.log(`  ${C.a}History scanned in part. Run with --full-history for the rest.${C.n}`)
    if (!all.length && !gaps.length) console.log(`  ${C.d}No candidates is not proof of absence: it is absence of matched patterns.${C.n}`)
  }
  const blocks = count('critical') + count('high') > 0
  return blocks ? 2 : (gaps.length ? 1 : 0)
}

// --------------------------------------------------------------------------- main
if (flag('help') || flag('h')) {
  console.log(`provensec app scan: secrets, code patterns, dependencies

usage: provensec-app [--dir <folder>] [--full-history] [--commits N]
                     [--max-file-mb N] [--dependencies] [--json]

  Looks for keys and passwords on disk and in git history, and for dangerous
  code patterns. Node and git only: nothing installed, nothing leaves the machine.
  --dependencies runs npm audit, which contacts the npm registry.

  Exit 0 = everything ran, nothing critical/high
  Exit 1 = some stage did not fully run (declared gap, NOT a green)
  Exit 2 = critical or high candidates found`)
  process.exit(0)
}
const p = recon()
const stages = [secretsStage(p), codeStage(p), depsStage(p)]
process.exit(report(p, stages))
