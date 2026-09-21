// ProvenSec app rules. Zero dependencies: regular expressions over text.
// Key formats come from each provider's public documentation. The insecure-defaults
// idea comes from Trail of Bits (CC BY-SA 4.0); no text was copied.
// Tests: rules.test.mjs, next to this file.
//
// Every code rule reads ONE line of text. It does not understand the code: it flags a
// candidate, and the verdict rule in ../../provensec/verdict.md decides.

// ------------------------------------------------------------------ secrets
// severity: critical = full power or money; high = service credential;
// warning = generic shape, more prone to false alarms.
export const SECRETS = [
  { id: 'private-key', severity: 'critical', says: 'Private key (SSH, TLS or signing) written in a file', re: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/g },
  { id: 'supabase-service-role', severity: 'critical', says: 'Supabase admin key: bypasses every access rule in the database', re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, verify: (v) => jwtRole(v) === 'service_role' },
  { id: 'stripe-live', severity: 'critical', says: 'Live Stripe secret key: moves money', re: /\b(?:sk|rk)_live_[A-Za-z0-9]{20,}\b/g },
  { id: 'aws-access-key', severity: 'critical', says: 'AWS access key', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { id: 'github-token', severity: 'high', says: 'GitHub token', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{60,})\b/g },
  { id: 'openai-key', severity: 'high', says: 'OpenAI key: bills your account', re: /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/g, except: /^sk-ant-/ },
  { id: 'anthropic-key', severity: 'high', says: 'Anthropic key: bills your account', re: /\bsk-ant-[A-Za-z0-9_-]{32,}\b/g },
  { id: 'google-api-key', severity: 'high', says: 'Google API key', re: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { id: 'slack-token', severity: 'high', says: 'Slack token', re: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { id: 'slack-webhook', severity: 'high', says: 'Slack webhook: anyone can post to the channel', re: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/]{20,}/g },
  { id: 'discord-webhook', severity: 'high', says: 'Discord webhook: anyone can post to the channel', re: /https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]{30,}/g },
  { id: 'telegram-bot', severity: 'high', says: 'Telegram bot token', re: /\b\d{8,10}:AA[A-Za-z0-9_-]{33}\b/g },
  { id: 'sendgrid-key', severity: 'high', says: 'SendGrid key: sends email as your domain', re: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g },
  { id: 'resend-key', severity: 'high', says: 'Resend key: sends email as your domain', re: /\bre_[A-Za-z0-9]{8,}_[A-Za-z0-9]{16,}\b/g },
  { id: 'twilio-key', severity: 'high', says: 'Twilio key', re: /\bSK[0-9a-f]{32}\b/g },
  { id: 'npm-token', severity: 'high', says: 'npm token: publishes packages under your name', re: /\bnpm_[A-Za-z0-9]{36}\b/g },
  { id: 'apify-token', severity: 'high', says: 'Apify token', re: /\bapify_api_[A-Za-z0-9]{30,}\b/g },
  { id: 'vercel-token', severity: 'high', says: 'Vercel token', re: /\b(?:vercel_|vc[pkai]_)[A-Za-z0-9]{24,}\b/g },
  { id: 'database-url-with-password', severity: 'high', says: 'Database URL with user and password', re: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss):\/\/[^\s:/@'"]+:([^\s@'"]{6,})@[^\s'"]+/g, group: 1 },
  { id: 'stripe-test', severity: 'warning', says: 'Test-mode Stripe secret key: moves no money, but should not be in code', re: /\bsk_test_[A-Za-z0-9]{20,}\b/g },
  { id: 'generic-secret', severity: 'warning', says: 'Secret-looking value assigned to a secret-looking name', re: /(?:secret|token|api[_-]?key|apikey|password|passwd|senha|private[_-]?key)["']?\s*[:=]\s*["']([^"'\s]{16,})["']/gi, group: 1, entropy: 3.5 },
]

const PLACEHOLDER = /(x{4,}|\*{4,}|example|exemplo|sample|placeholder|dummy|changeme|your[_-]|<[^>]*>|\$\{|process\.env|import\.meta|redacted|fake|test123|12345678|abcdef)/i

function entropy(s) {
  const f = {}
  for (const c of s) f[c] = (f[c] || 0) + 1
  return Object.values(f).reduce((h, n) => h - (n / s.length) * Math.log2(n / s.length), 0)
}
function jwtRole(t) {
  try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf-8')).role ?? null }
  catch { return null }
}
/** Drops what matched the shape but is not a real secret. */
export function looksSecret(v, rule) {
  if (!v) return false
  if (PLACEHOLDER.test(v)) return false
  if (rule.except && rule.except.test(v)) return false
  if (rule.verify && !rule.verify(v)) return false
  if (rule.entropy && entropy(v) < rule.entropy) return false
  return true
}

// -------------------------------------------------------------------- code
// clientOnly: only flags in files that start with 'use client'.
export const CODE = [
  // Insecure defaults: configuration that opens the app when someone skips a step.
  { id: 'secret-with-fallback', severity: 'high', says: 'If the variable is missing on the server, the app uses a value written in the code, and anyone who reads the repo has the key (A05)', re: /process\.env\.[A-Z0-9_]*(?:SECRET|TOKEN|KEY|PASSWORD|SALT|JWT)[A-Z0-9_]*\s*(?:\|\||\?\?)\s*["'`][^"'`]+["'`]/ },
  { id: 'supabase-admin-key-public-name', severity: 'critical', says: 'Supabase admin key with a public prefix: it ships in the code the browser downloads (A02)', re: /NEXT_PUBLIC_[A-Z0-9_]*(?:SERVICE_ROLE|SERVICE_KEY|SECRET)/ },
  { id: 'admin-key-in-client-component', severity: 'critical', says: 'Admin key used in a component that runs in the browser (A02)', re: /SERVICE_ROLE|serviceRole/, clientOnly: true },
  { id: 'cors-any-origin', severity: 'warning', says: 'Any website can call this API from the browser. With a session, the other site acts as your user (A24)', re: /origin\s*:\s*["']\*["']|Access-Control-Allow-Origin["']?\s*[,:]\s*["']\*["']/ },
  { id: 'source-maps-in-production', severity: 'warning', says: 'The site publishes the original source code next to the JavaScript (A27)', re: /productionBrowserSourceMaps\s*:\s*true/ },
  { id: 'tls-verification-off', severity: 'high', says: 'The app accepts any certificate: anyone in the middle of the network reads and changes the traffic (A29)', re: /NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0|rejectUnauthorized\s*:\s*false/ },
  { id: 'token-decoded-not-verified', severity: 'warning', says: 'The token is read without checking its signature. If this decides who the user is, anyone can write their own token (A38)', re: /\bjwt\.decode\s*\(|\bjwtDecode\s*\(|\bdecodeJwt\s*\(/ },
  { id: 'token-verified-without-algorithm', severity: 'warning', says: 'Without an algorithm list, the token itself chooses how it is checked (A38)', re: /\bjwt\.verify\s*\(/, except: /algorithms\s*:/ },
  // Dangerous patterns: user input turning into code.
  { id: 'raw-html-on-screen', severity: 'warning', says: 'HTML inserted straight into the page. If the content comes from users, it runs as script in the viewer\'s session (A12)', re: /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML\s*\(|document\.write\s*\(|v-html\s*=|\{@html\s/ },
  { id: 'text-run-as-code', severity: 'high', says: 'Text executed as code. If the text comes from outside, whoever sends it runs anything on the server (A14)', re: /\beval\s*\(|new\s+Function\s*\(|setTimeout\s*\(\s*["'`]|vm\.runIn\w*Context\s*\(/ },
  { id: 'shell-command-built-from-text', severity: 'high', says: 'System command built from variable text. If the variable comes from the user, they run commands on the server (A14)', re: /\b(?:exec|execSync|spawn|spawnSync)\s*\(\s*(?:`[^`]*\$\{|["'][^"']*["']\s*\+)/ },
  { id: 'sql-built-from-text', severity: 'high', says: 'Database query built by pasting text. If the text comes from the user, they read or wipe the database (A11)', re: /(?:query|execute|raw|sql|\$queryRawUnsafe|\$executeRawUnsafe|unsafe)\s*\(\s*(?:`[^`]*\b(?:SELECT|INSERT|UPDATE|DELETE|WHERE)\b[^`]*\$\{|["'][^"']*\b(?:SELECT|INSERT|UPDATE|DELETE|WHERE)\b[^"']*["']\s*\+)/i },
  { id: 'redirect-from-request', severity: 'warning', says: 'The redirect target comes from the request. Without an allowlist, a link on your domain leads to a fake site (A36)', re: /redirect\s*\(\s*(?:req\.(?:query|body|params)|searchParams\.get|request\.nextUrl\.searchParams)/ },
  { id: 'fetch-user-supplied-url', severity: 'warning', says: 'The server fetches an address that comes from the request. Without an allowlist, it becomes a bridge into the internal network (A35)', re: /\b(?:fetch|axios\.(?:get|post)|got)\s*\(\s*(?:req\.(?:query|body|params)|body\.|searchParams\.get)/ },
]
