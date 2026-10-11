import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateReport, readReport, MAX_BYTES } from './validate-report.mjs';

const example = new URL('../examples/audit-report.json', import.meta.url);
const evidence = () => [{ path: 'src/auth.ts', line: 8, statement: 'Fixture evidence for an observed boundary.' }];
const clean = () => readReport(example);
const candidate = (verdict = 'confirmed') => {
  const report = clean();
  report.findings.push({ id: 'finding.session-owner', root_cause: 'session handler omits owner authorization', coverage_ids: ['auth.session-boundary'], verdict, evidence: evidence() });
  report.coverage[0].finding_ids.push('finding.session-owner');
  if (verdict === 'confirmed') Object.assign(report.findings[0], { severity: 'high', observed_result: 'The bounded dummy-user fixture returned another user session.', impact: 'A second dummy user can read the first user session.', remediation: 'Enforce the owner check before returning the session.' });
  if (verdict === 'dismissed') report.findings[0].reason = 'The upstream owner check prevents this path.';
  if (verdict === 'not_verified') {
    Object.assign(report.findings[0], { blocker: 'A deployment setting is unavailable.', next_check: 'Ask the owner to inspect the named setting without sending audit traffic.' });
    report.coverage[0].status = 'candidate';
    report.coverage[0].reason = 'A candidate remains unverified.';
    report.run_status = 'incomplete';
    report.incomplete_reason = 'Deployment setting remains unverified.';
  }
  return report;
};
const valid = report => assert.deepEqual(validateReport(report), []);
const invalid = report => assert.ok(validateReport(report).length > 0);

test('example is a valid bounded clean run, including explicit exclusion', () => valid(clean()));
test('all verdicts can be represented', () => ['confirmed', 'dismissed', 'not_verified'].forEach(v => valid(candidate(v))));
test('null, arrays and malformed nested records report errors without throwing', () => {
  [null, [], 1, 'report', {}, { source: null, coverage: [null], findings: [null] }].forEach(invalid);
  const mutations = [r => r.source = null, r => r.coverage[0].checks = [null], r => r.coverage[0].checks[0].evidence = [null], r => r.findings[0].evidence = {}, r => r.findings[0].verification = null, r => r.findings[0].coverage_ids = [null, {}], r => r.coverage[0].finding_ids = null];
  mutations.forEach(mutate => { const r = candidate(); mutate(r); invalid(r); });
});
test('empty coverage and missing findings array are invalid', () => {
  const r = clean(); r.coverage = []; invalid(r);
  delete r.findings; invalid(r);
});
test('planned and unknown states cannot silently pass', () => {
  const r = clean(); r.coverage[0].status = 'planned'; invalid(r);
  r.coverage[0].status = 'done'; invalid(r);
  r.coverage_claim = 'secure'; invalid(r);
});
test('incomplete partial coverage is valid only with reasons', () => {
  for (const status of ['blocked', 'deferred', 'candidate']) {
    const r = candidate('not_verified'); r.coverage[0].status = status; r.coverage[0].reason = 'Local execution unavailable'; valid(r);
    delete r.coverage[0].reason; invalid(r);
  }
});
test('false complete rejects every unresolved coverage state and verdict', () => {
  for (const status of ['blocked', 'deferred', 'candidate']) {
    const r = candidate(); r.coverage[0].status = status; r.coverage[0].reason = 'Unresolved'; invalid(r);
  }
  const r = candidate('not_verified'); r.run_status = 'complete'; delete r.incomplete_reason; invalid(r);
});
test('references must resolve in both directions and be unique', () => {
  const mutations = [r => r.coverage[0].finding_ids = [], r => r.findings[0].coverage_ids = ['unknown'], r => r.coverage[0].finding_ids = ['unknown'], r => r.findings[0].coverage_ids = [], r => r.findings.push(structuredClone(r.findings[0])), r => r.coverage.push(structuredClone(r.coverage[0])), r => r.coverage[0].finding_ids.push(r.findings[0].id)];
  mutations.forEach(mutate => { const r = candidate(); mutate(r); invalid(r); });
});
test('out-of-scope units cannot claim findings', () => {
  const r = candidate(); r.coverage[0].status = 'out_of_scope'; r.coverage[0].reason = 'Excluded'; invalid(r);
});
test('evidence needs a safe path, positive line and statement', () => {
  for (const value of [0, -1, 1.1, '2', null]) { const r = candidate(); r.findings[0].evidence[0].line = value; invalid(r); }
  for (const value of ['/private/file', '../secret', 'a/../b', 'C:\\file', 'a\\b', '', 'a\n']) { const r = candidate(); r.findings[0].evidence[0].path = value; invalid(r); }
  const r = candidate(); r.findings[0].evidence[0].statement = ''; invalid(r);
  r.findings[0].evidence = []; invalid(r);
});
test('verdict-specific fields cannot contradict the verdict', () => {
  for (const verdict of ['dismissed', 'not_verified']) { const r = candidate(verdict); r.findings[0].severity = 'high'; invalid(r); }
  for (const field of ['severity', 'impact', 'remediation', 'observed_result']) { const r = candidate(); delete r.findings[0][field]; invalid(r); }
  const r = candidate(); r.findings[0].blocker = 'Contradiction'; invalid(r);
});
test('deep confirmation needs distinct participants and verification evidence', () => {
  const r = candidate(); r.mode = 'deep'; invalid(r);
  r.findings[0].discoverer_id = 'hunter-1';
  r.findings[0].verification = { verifier_id: 'hunter-1', evidence: evidence() }; invalid(r);
  r.findings[0].verification.verifier_id = 'reviewer-1'; valid(r);
  r.findings[0].verification.evidence = []; invalid(r);
});
test('source identity and stable IDs have required types', () => {
  const r = clean(); r.source.dirty = 'false'; invalid(r);
  r.source.dirty = false; r.source.revision = ''; invalid(r);
  const f = candidate(); f.findings[0].id = 'contains spaces'; invalid(f);
});
test('unknown fields reject accidental total-security claims', () => {
  const r = clean(); r.secure = true; invalid(r);
});
test('CLI exit codes, bounded input and non-regular input', () => {
  const dir = mkdtempSync(join(tmpdir(), 'provensec-contract-'));
  const cli = fileURLToPath(new URL('./validate-report.mjs', import.meta.url));
  const run = path => spawnSync(process.execPath, [cli, path], { encoding: 'utf8', timeout: 5000 });
  try {
    assert.equal(run(fileURLToPath(example)).status, 0);
    assert.match(run(fileURLToPath(example)).stdout, /were not verified/);
    const bad = join(dir, 'bad.json'); writeFileSync(bad, '{');
    assert.equal(run(bad).status, 1);
    assert.match(run(bad).stderr, /Invalid report:/);
    writeFileSync(bad, ' '.repeat(MAX_BYTES + 1)); assert.equal(run(bad).status, 1);
    assert.equal(run(dir).status, 1);
    assert.equal(run(join(dir, 'missing.json')).status, 1);
    const link = join(dir, 'link.json'); symlinkSync(fileURLToPath(example), link); assert.equal(run(link).status, 1);
    writeFileSync(bad, Buffer.from([0xff])); assert.equal(run(bad).status, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('complete requires a covered in-scope unit', () => {
  const r = clean(); r.coverage = [r.coverage[1]]; invalid(r);
  r.run_status = 'incomplete'; r.incomplete_reason = 'No in-scope checks ran.'; valid(r);
});
test('coverage state must reflect the linked candidate disposition', () => {
  const r = candidate('not_verified'); r.coverage[0].status = 'covered'; invalid(r);
  const resolved = candidate(); resolved.run_status = 'incomplete'; resolved.incomplete_reason = 'Partial pass';
  resolved.coverage[0].status = 'candidate'; resolved.coverage[0].reason = 'Candidate open'; invalid(resolved);
});

test('parsed JSON object IDs return errors without diagnostic coercion crashes', () => {
  const r = candidate();
  r.coverage[0].id = JSON.parse('{"toString":null}');
  r.coverage[0].finding_ids = ['unknown'];
  invalid(r);
  const f = candidate();
  f.findings[0].id = JSON.parse('{"toString":null}');
  f.findings[0].coverage_ids = ['unknown'];
  invalid(f);
});


test('CLI invoked through a script symlink still validates and fails closed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'provensec-cli-link-'));
  try {
    const link = join(dir, 'validate-report.mjs');
    symlinkSync(fileURLToPath(new URL('./validate-report.mjs', import.meta.url)), link);
    const run = file => spawnSync(process.execPath, [link, file], { encoding: 'utf8', timeout: 5000 });
    const accepted = run(fileURLToPath(example));
    assert.equal(accepted.status, 0);
    assert.match(accepted.stdout, /Contract valid/);
    const preserved = spawnSync(process.execPath, ['--preserve-symlinks-main', link, join(dir, 'missing.json')], { encoding: 'utf8', timeout: 5000 });
    assert.equal(preserved.status, 1);
    assert.match(preserved.stderr, /Invalid report/);
    const imported = spawnSync(process.execPath, ['--input-type=module', '-'], { input: `import { validateReport } from ${JSON.stringify(new URL('./validate-report.mjs', import.meta.url).href)}; console.log(validateReport(null).length);`, encoding: 'utf8', timeout: 5000 });
    assert.equal(imported.status, 0);
    assert.equal(imported.stdout.trim(), '1');
    const rejected = run(join(dir, 'missing.json'));
    assert.equal(rejected.status, 1);
    assert.match(rejected.stderr, /Invalid report/);
    const malformed = join(dir, 'malformed.json');
    writeFileSync(malformed, '{}');
    assert.equal(run(malformed).status, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
