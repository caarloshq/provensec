import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const scanner = fileURLToPath(new URL('../skills/provensec-app/scripts/provensec-app.mjs', import.meta.url))

function repository(t, source = 'export const value = 1\n') {
  const dir = mkdtempSync(join(tmpdir(), 'provensec-history-'))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: 'pipe' })
  git('init', '--quiet')
  git('config', 'user.name', 'Scanner Test')
  git('config', 'user.email', 'scanner@example.invalid')
  writeFileSync(join(dir, 'app.mjs'), source)
  git('add', 'app.mjs')
  git('-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'Initial source')
  writeFileSync(join(dir, 'notes.md'), 'Second commit in the scanned folder.\n')
  git('add', 'notes.md')
  git('-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', 'commit', '--quiet', '-m', 'Add notes')
  return dir
}

function scan(dir, ...args) {
  const result = spawnSync(process.execPath, [scanner, '--dir', dir, ...args], { encoding: 'utf8' })
  assert.ifError(result.error)
  assert.equal(result.signal, null)
  assert.equal(result.stderr, '')
  return result
}

test('capped clean history exits 1 and reports the coverage gap without a green mark', t => {
  const result = scan(repository(t), '--commits', '1')
  assert.equal(result.status, 1)
  assert.match(result.stdout, /❌ Secrets on disk and in history/)
  assert.match(result.stdout, /1 of 2 commits/)
  assert.match(result.stdout, /1 stage\(s\) did not fully run/)
  assert.match(result.stdout, /Run with --full-history/)
  assert.doesNotMatch(result.stdout, /No candidates is not proof/)
})

test('JSON retains explicit partial coverage and exits 1 for capped clean history', t => {
  const result = scan(repository(t), '--commits', '1', '--json')
  assert.equal(result.status, 1)
  const report = JSON.parse(result.stdout)
  assert.equal(report.project.commits, 2)
  assert.equal(report.stages[0].partial, true)
  assert.match(report.stages[0].scope, /1 of 2 commits/)
  assert.deepEqual(report.findings, [])
})

test('full history overrides the cap and exits 0 with complete JSON coverage', t => {
  const result = scan(repository(t), '--commits', '1', '--full-history', '--json')
  assert.equal(result.status, 0)
  const report = JSON.parse(result.stdout)
  assert.equal(report.stages[0].status, 'ran')
  assert.equal(report.stages[0].partial, false)
  assert.match(report.stages[0].scope, /· 2 commits$/)
  assert.deepEqual(report.findings, [])
})

test('high candidates retain exit 2 while partial history remains a declared gap', t => {
  const dir = repository(t, 'eval(input)\n')
  const result = scan(dir, '--commits', '1')
  assert.equal(result.status, 2)
  assert.match(result.stdout, /1 stage\(s\) did not fully run/)
  assert.match(result.stdout, /Run with --full-history/)
  const jsonResult = scan(dir, '--commits', '1', '--json')
  assert.equal(jsonResult.status, 2)
  const report = JSON.parse(jsonResult.stdout)
  assert.equal(report.stages[0].partial, true)
  assert.ok(report.findings.some(f => f.severity === 'high' && f.rule === 'text-run-as-code'))
})
