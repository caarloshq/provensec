// Rule tests: every rule MUST flag its bad case and MUST NOT flag its good case.
// Run: node rules.test.mjs  (exits 1 if any case fails)
// Fake keys are assembled at runtime with `j()`, so no key-shaped value is written in
// this file and ProvenSec does not flag its own test.
import { SECRETS, CODE, looksSecret } from './rules.mjs'

const j = (...p) => p.join('')
const rep = (c, n) => c.repeat(n)
const jwt = (papel) => j('eyJhbGciOiJIUzI1NiJ9.', Buffer.from(JSON.stringify({ role: papel, iss: 'supabase' })).toString('base64url'), '.', rep('Q', 43))

const secretCases = {
  'private-key': [j('-----BEGIN ', 'OPENSSH PRIVATE KEY-----'), '-----BEGIN PUBLIC KEY-----'],
  'supabase-service-role': [jwt('service_role'), jwt('anon')],
  'stripe-live': [j('sk_', 'live_', 'Ab3dEf6hIj9kLm2nOp5qRs8t'), j('pk_', 'live_', 'Ab3dEf6hIj9kLm2nOp5qRs8t')],
  'aws-access-key': [j('AKIA', 'Q7ZK3MT2WX9PL4RB'), j('AKIA', 'IOSFODNN7EXAMPLE')],
  'github-token': [j('ghp_', 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8'), 'ghp_curto'],
  'openai-key': [j('sk-', 'proj-', 'Zq8Wm3Xk2Lp9Rt4Yv7Nb1Hc6Jd5Fg0Ss3Aa'), j('sk-', 'ant-', 'Zq8Wm3Xk2Lp9Rt4Yv7Nb1Hc6Jd5Fg0Ss3Aa')],
  'anthropic-key': [j('sk-', 'ant-', 'api03-Zq8Wm3Xk2Lp9Rt4Yv7Nb1Hc6Jd5Fg0Ss3'), 'sk-ant-curta'],
  'google-api-key': [j('AIza', 'Sy9Qm2Xk7Lp3Rt8Yv1Nb6Hc0Jd4Fg5Ss2Aw'), 'AIzaCurta'],
  'slack-webhook': [j('https://hooks.slack.com/services/', 'T0AB12CD3/B0EF45GH6/', 'Zq8Wm3Xk2Lp9Rt4Yv7Nb1Hc6'), 'https://hooks.slack.com/'],
  'telegram-bot': [j('987654321:', 'AA', 'Fq8Wm3Xk2Lp9Rt4Yv7Nb1Hc6Jd5Fg0Ss3'), '123456789:BBcurto'],
  'npm-token': [j('npm_', 'Zq8Wm3Xk2Lp9Rt4Yv7Nb1Hc6Jd5Fg0Ss3Aaw'), 'npm_install'],
  'slack-token': [j('xoxb-', '9876543210-', 'Zq8Wm3Xk2Lp9Rt4Y'), 'xoxb-'],
  'discord-webhook': [j('https://discord.com/api/webhooks/', '112233445566778899/', 'Zq8Wm3Xk2Lp9Rt4Yv7Nb1Hc6Jd5Fg0Ss3Aa'), 'https://discord.com/api/'],
  'sendgrid-key': [j('SG.', 'Zq8Wm3Xk2Lp9Rt4Yv7Nb1H', '.', 'Zq8Wm3Xk2Lp9Rt4Yv7Nb1Hc6Jd5Fg0Ss3Aa7Kd9Qe2W'), 'SG.curta'],
  'resend-key': [j('re_', 'Zq8Wm3Xk', '_', 'Lp9Rt4Yv7Nb1Hc6Jd5Fg'), 'are_you_there'],
  'twilio-key': [j('SK', '9f8e7d6c5b4a39281706f5e4d3c2b1a0'), 'SKU-123'],
  'vercel-token': [j('vercel_', 'Zq8Wm3Xk2Lp9Rt4Yv7Nb1Hc6Jd'), 'vercel_app'],
  'apify-token': [j('apify_', 'api_', 'Zq8Wm3Xk2Lp9Rt4Yv7Nb1Hc6Jd5Fg0Ss3Aa'), 'apify_api_'],
  'database-url-with-password': [j('postgres://app:', 'Hq7mZ2xW9k@', 'db.example.com:5432/app'), 'postgres://localhost:5432/app'],
  'stripe-test': [j('sk_', 'test_', 'Ab3dEf6hIj9kLm2nOp5qRs8t'), 'sk_test_'],
  'generic-secret': [j('api_key: "', 'k9Qz2Wm7Xr4Lp8Vt3Nb6Hy1', '"'), 'api_key: "your_api_key_here_please"'],
}

const codeCases = {
  'secret-with-fallback': ["const s = process.env.JWT_SECRET || 'dev-secret'", "const port = process.env.PORT || '3000'"],
  'supabase-admin-key-public-name': ['process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY', 'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY'],
  'cors-any-origin': ["app.use(cors({ origin: '*' }))", "app.use(cors({ origin: ['https://app.example.com'] }))"],
  'source-maps-in-production': ['productionBrowserSourceMaps: true', 'productionBrowserSourceMaps: false'],
  'tls-verification-off': ["process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'", 'new https.Agent({ keepAlive: true })'],
  'token-decoded-not-verified': ['const p = jwt.decode(token)', 'const p = jwt.verify(token, s, { algorithms: ["HS256"] })'],
  'token-verified-without-algorithm': ['jwt.verify(token, secret)', 'jwt.verify(token, secret, { algorithms: ["HS256"] })'],
  'raw-html-on-screen': ['<div dangerouslySetInnerHTML={{ __html: bio }} />', '<div>{bio}</div>'],
  'text-run-as-code': ['eval(req.body.expr)', 'const score = measure(x)'],
  'shell-command-built-from-text': ['exec(`convert ${file} out.png`)', "execFile('convert', [file, 'out.png'])"],
  'sql-built-from-text': ['db.query(`SELECT * FROM orders WHERE id = ${req.params.id}`)', "db.query('SELECT * FROM orders WHERE id = $1', [id])"],
  'redirect-from-request': ['return redirect(searchParams.get("next"))', "return redirect('/dashboard')"],
  'admin-key-in-client-component': ['createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY)', 'createClient(url, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)'],
  'fetch-user-supplied-url': ['const r = await fetch(req.body.url)', "const r = await fetch('https://api.example.com/v1')"],
}

let failures = 0, cases = 0
const noCase = []
const flagsSecret = (r, t) => { r.re.lastIndex = 0; let m; while ((m = r.re.exec(t))) { if (looksSecret(m[r.group ?? 0], r)) return true; if (!r.re.global) break } return false }
const flagsCode = (r, t) => r.re.test(t) && !(r.except && r.except.test(t))
// clientOnly: the scanner checks the 'use client' file; this test checks the line only.
function check(group, rules, casesOf, flags) {
  for (const r of rules) {
    const c = casesOf[r.id]
    if (!c) { console.log(`  NO CASE  ${group} · ${r.id}`); noCase.push(r.id); continue }
    const [bad, good] = c
    cases += 2
    if (!flags(r, bad)) { console.log(`  FAILED   ${r.id} did not flag the bad case`); failures++ }
    if (flags(r, good)) { console.log(`  FAILED   ${r.id} flagged the good case`); failures++ }
  }
}
check('secret', SECRETS, secretCases, flagsSecret)
check('code', CODE, codeCases, flagsCode)
console.log(`${cases} cases · ${failures} failure(s) · ${noCase.length} rule(s) without a test case`)
process.exit(failures || noCase.length ? 1 : 0)
