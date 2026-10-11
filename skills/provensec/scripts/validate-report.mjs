#!/usr/bin/env node
import { constants, openSync, fstatSync, readSync, closeSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const MAX_BYTES = 1024 * 1024;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const id = value => typeof value === 'string' && /^[a-z0-9][a-z0-9._:-]{0,159}$/.test(value);
const relative = value => nonempty(value) && !value.startsWith('/') && !value.includes('\\') && !/^[a-zA-Z]:/.test(value) && !value.split('/').some(x => !x || x === '.' || x === '..') && !/[\x00-\x1f\x7f]/.test(value);

/** Check declarations and consistency only; never execute or open evidence paths. */
export function validateReport(report) {
  const errors = [];
  const fail = (at, message) => errors.push(`${at}: ${message}`);
  const text = (value, at) => { if (!nonempty(value)) fail(at, 'must be a nonempty string'); };
  const choice = (value, values, at) => { if (!values.includes(value)) fail(at, `must be one of ${values.join(', ')}`); };
  const obj = (value, at) => { if (!record(value)) { fail(at, 'must be an object'); return false; } return true; };
  const list = (value, at, minimum = 0) => { if (!Array.isArray(value) || value.length < minimum) { fail(at, `must be an array with at least ${minimum} entries`); return []; } return value; };
  const keys = (value, allowed, at) => { for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${at}.${key}`, 'unknown field'); };
  const refs = (value, at, minimum = 0) => {
    const entries = list(value, at, minimum);
    const seen = new Set();
    entries.forEach((entry, i) => {
      if (!id(entry)) fail(`${at}[${i}]`, 'must be a stable lowercase ID');
      if (seen.has(entry)) fail(at, 'duplicate ID');
      seen.add(entry);
    });
    return entries;
  };
  const evidence = (value, at) => list(value, at, 1).forEach((entry, i) => {
    const loc = `${at}[${i}]`;
    if (!obj(entry, loc)) return;
    keys(entry, ['path', 'line', 'statement'], loc);
    if (!relative(entry.path)) fail(`${loc}.path`, 'must be a safe repository-relative path');
    if (!Number.isSafeInteger(entry.line) || entry.line < 1) fail(`${loc}.line`, 'must be a positive safe integer');
    text(entry.statement, `${loc}.statement`);
  });
  if (!obj(report, 'report')) return errors;
  keys(report, ['schema_version', 'source', 'mode', 'run_status', 'coverage_claim', 'incomplete_reason', 'coverage', 'findings'], 'report');
  choice(report.schema_version, ['1.0'], 'schema_version');
  if (obj(report.source, 'source')) {
    keys(report.source, ['revision', 'dirty'], 'source');
    text(report.source.revision, 'source.revision');
    if (typeof report.source.dirty !== 'boolean') fail('source.dirty', 'must be a boolean');
  }
  choice(report.mode, ['quick', 'deep'], 'mode');
  choice(report.run_status, ['complete', 'incomplete'], 'run_status');
  choice(report.coverage_claim, ['bounded'], 'coverage_claim');
  if (report.run_status === 'incomplete') text(report.incomplete_reason, 'incomplete_reason');
  else if ('incomplete_reason' in report) fail('incomplete_reason', 'allowed only for incomplete runs');
  const coverage = list(report.coverage, 'coverage', 1);
  const findings = list(report.findings, 'findings');
  if (report.run_status === 'complete' && !coverage.some(unit => record(unit) && unit.status === 'covered')) fail('coverage', 'complete requires at least one covered in-scope unit');
  const units = new Map(), items = new Map(), roots = new Set();
  coverage.forEach((unit, i) => {
    const at = `coverage[${i}]`;
    if (!obj(unit, at)) return;
    keys(unit, ['id', 'scope', 'paths', 'status', 'checks', 'finding_ids', 'reason'], at);
    if (!id(unit.id)) fail(`${at}.id`, 'must be a stable lowercase ID');
    if (units.has(unit.id)) fail(`${at}.id`, 'duplicate coverage ID');
    if (id(unit.id)) units.set(unit.id, unit);
    text(unit.scope, `${at}.scope`);
    list(unit.paths, `${at}.paths`, 1).forEach((p, n) => { if (!relative(p)) fail(`${at}.paths[${n}]`, 'must be a safe repository-relative path'); });
    choice(unit.status, ['covered', 'blocked', 'deferred', 'out_of_scope', 'candidate'], `${at}.status`);
    if (unit.status !== 'covered') text(unit.reason, `${at}.reason`);
    list(unit.checks, `${at}.checks`, unit.status === 'covered' ? 1 : 0).forEach((check, n) => {
      const loc = `${at}.checks[${n}]`;
      if (!obj(check, loc)) return;
      keys(check, ['name', 'evidence'], loc);
      text(check.name, `${loc}.name`);
      evidence(check.evidence, `${loc}.evidence`);
    });
    refs(unit.finding_ids, `${at}.finding_ids`, unit.status === 'candidate' ? 1 : 0);
    if (unit.status === 'out_of_scope' && Array.isArray(unit.finding_ids) && unit.finding_ids.length) fail(`${at}.finding_ids`, 'out_of_scope units cannot claim findings');
    if (report.run_status === 'complete' && ['blocked', 'deferred', 'candidate'].includes(unit.status)) fail(`${at}.status`, 'unresolved coverage requires an incomplete run');
  });
  findings.forEach((finding, i) => {
    const at = `findings[${i}]`;
    if (!obj(finding, at)) return;
    keys(finding, ['id', 'root_cause', 'coverage_ids', 'verdict', 'evidence', 'severity', 'impact', 'remediation', 'observed_result', 'reason', 'blocker', 'next_check', 'discoverer_id', 'verification'], at);
    if (!id(finding.id)) fail(`${at}.id`, 'must be a stable lowercase ID');
    if (items.has(finding.id)) fail(`${at}.id`, 'duplicate finding ID');
    if (id(finding.id)) items.set(finding.id, finding);
    text(finding.root_cause, `${at}.root_cause`);
    if (roots.has(finding.root_cause)) fail(`${at}.root_cause`, 'duplicate root cause; consolidate locations');
    roots.add(finding.root_cause);
    refs(finding.coverage_ids, `${at}.coverage_ids`, 1);
    choice(finding.verdict, ['confirmed', 'dismissed', 'not_verified'], `${at}.verdict`);
    evidence(finding.evidence, `${at}.evidence`);
    if (finding.verdict === 'confirmed') {
      choice(finding.severity, ['low', 'medium', 'high', 'critical'], `${at}.severity`);
      text(finding.impact, `${at}.impact`);
      text(finding.observed_result, `${at}.observed_result`);
      text(finding.remediation, `${at}.remediation`);
    }
    if (finding.verdict === 'dismissed') text(finding.reason, `${at}.reason`);
    if (finding.verdict === 'not_verified') {
      text(finding.blocker, `${at}.blocker`);
      text(finding.next_check, `${at}.next_check`);
      if (report.run_status === 'complete') fail(`${at}.verdict`, 'not_verified requires an incomplete run');
    }
    const verdictFields = { severity: 'confirmed', impact: 'confirmed', remediation: 'confirmed', observed_result: 'confirmed', reason: 'dismissed', blocker: 'not_verified', next_check: 'not_verified' };
    for (const [field, verdict] of Object.entries(verdictFields)) if (field in finding && finding.verdict !== verdict) fail(`${at}.${field}`, `allowed only for ${verdict}`);
    const independent = report.mode === 'deep' && finding.verdict === 'confirmed';
    if (independent || 'discoverer_id' in finding || 'verification' in finding) {
      if (!id(finding.discoverer_id)) fail(`${at}.discoverer_id`, 'must be a stable lowercase ID');
      if (obj(finding.verification, `${at}.verification`)) {
        keys(finding.verification, ['verifier_id', 'evidence'], `${at}.verification`);
        if (!id(finding.verification.verifier_id)) fail(`${at}.verification.verifier_id`, 'must be a stable lowercase ID');
        if (finding.verification.verifier_id === finding.discoverer_id) fail(`${at}.verification.verifier_id`, 'must differ from discoverer_id');
        evidence(finding.verification.evidence, `${at}.verification.evidence`);
      }
    }
  });
  for (const [unitId, unit] of units) for (const findingId of Array.isArray(unit.finding_ids) ? unit.finding_ids : []) {
    const finding = items.get(findingId);
    if (!finding) fail(`coverage.${unitId}.finding_ids`, 'references unknown finding');
    else if (unit.status === 'covered' && finding.verdict === 'not_verified') fail(`coverage.${unitId}.status`, 'covered cannot link not_verified');
    else if (!Array.isArray(finding.coverage_ids) || !finding.coverage_ids.includes(unitId)) fail(`coverage.${unitId}.finding_ids`, 'missing reverse coverage reference');
  }
  for (const [unitId, unit] of units) if (unit.status === 'candidate' && !(Array.isArray(unit.finding_ids) && unit.finding_ids.some(findingId => items.get(findingId)?.verdict === 'not_verified'))) fail(`coverage.${unitId}.status`, 'candidate requires a not_verified finding');
  for (const [findingId, finding] of items) for (const unitId of Array.isArray(finding.coverage_ids) ? finding.coverage_ids : []) {
    const unit = units.get(unitId);
    if (!unit) fail(`findings.${findingId}.coverage_ids`, 'references unknown coverage unit');
    else if (!Array.isArray(unit.finding_ids) || !unit.finding_ids.includes(findingId)) fail(`findings.${findingId}.coverage_ids`, 'missing reverse finding reference');
  }
  return errors;
}

export function readReport(filename) {
  // Nonblocking open prevents FIFO hangs; inspect the opened descriptor before reading.
  if (!Number.isInteger(constants.O_NONBLOCK) || !constants.O_NONBLOCK || !Number.isInteger(constants.O_NOFOLLOW) || !constants.O_NOFOLLOW) throw new Error('platform lacks required nonblocking/no-follow file controls');
  const fd = openSync(filename, constants.O_RDONLY | constants.O_NONBLOCK | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new Error('report input must be a regular file');
    if (stat.size > MAX_BYTES) throw new Error(`report exceeds ${MAX_BYTES} byte limit`);
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let total = 0;
    while (total < buffer.length) {
      const count = readSync(fd, buffer, total, buffer.length - total, null);
      if (!count) break;
      total += count;
    }
    if (total > MAX_BYTES) throw new Error(`report exceeds ${MAX_BYTES} byte limit`);
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, total)));
  } finally { closeSync(fd); }
}

function isCliEntry() {
  if (!process.argv[1]) return false;
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); }
  catch { return false; } // Imports from stdin/eval do not have a filesystem entrypoint.
}

if (isCliEntry()) {
  try {
    if (process.argv.length !== 3) throw new Error('Usage: node validate-report.mjs <report.json>');
    const errors = validateReport(readReport(process.argv[2]));
    if (errors.length) throw new Error(errors.slice(0, 40).join('\n') + (errors.length > 40 ? `\n... ${errors.length - 40} more errors` : ''));
    console.log('Contract valid. Evidence content, execution, identity and security were not verified.');
  } catch (error) {
    console.error(`Invalid report: ${error.message}`);
    process.exitCode = 1;
  }
}
