# App findings catalog

> **43 items, ordered from most to least severe.** The ruler for the order is not
> frequency or opinion: it is **how much damage, for how much effort**. Level 0 is open
> right now to anyone who has the URL. Level 4 needs someone who wants in.
>
> Items with a testing guide link to `../provensec-app/guides/`. Five more link to the
> original, deeper guides in [Strix](https://github.com/usestrix/strix) (Apache 2.0).

## How to use each row

**An item without a test that fails it is an item you ticked by feeling.** The "How to
test" column exists for that: run it first against a case you know is wrong and confirm it
flags. Silence from a broken test looks identical to silence from correct code.

An item you could not test goes into the report as NOT VERIFIED with the name of the gap,
never as green. Every candidate goes through [`verdict.md`](verdict.md) before it becomes a
finding.

---

## Level 0: already open

Anyone with the URL gets in. No account, no tool, no knowledge. **If any of these five
fails, stop everything and fix it before reading the rest.**

| # | What breaks, in practice | How to test | What to do |
|---|---|---|---|
| **A01** | Row Level Security off: the public database key reads the whole users table, everyone's data | Take the anon key from the front end and query the database API directly, without logging in. Did rows come back? It is open | Turn RLS on for every table and write a policy per table: each user sees only what is theirs. A public table is a declared exception, not the default |
| **A02** | Service key (the admin one) in the front end, the repo or a log: it ignores RLS and can do anything | Search for the service key's prefix in the published bundle, the git history and the logs. Found once, it leaked | Remove it, rotate it at the provider, and move the call to the server. The anon key can live in the front end; the service key, never |
| **A03** | Admin panel without authentication: `/admin` opens for whoever types it | Open the admin route in a private window | Authentication and authorization on the server, before rendering |
| **A04** | A route serves logged-in content to an anonymous visitor | **The 5-minute test:** open the app in a private window and try every route that should require login. Did anything show? It is not "could be breached", it is already open | Protection on the server, per route. Hiding the link from the menu does not protect the route |
| **A05** | `.env` committed, or an API key in the front-end bundle | Search the git history for the file, and the published bundle for the key. ⚠️ **`.gitignore` does not reach an already tracked file**, so a clean working tree proves nothing | Remove it from the index, rotate the key (history does not forget) and move the call to the server |

---

## Level 1: one changed parameter and the data belongs to someone else

Needs one account, and nothing else.

| # | What breaks, in practice | How to test | What to do |
|---|---|---|---|
| **A06** | Predictable ID in the URL with no owner check: change `/order/1042` to `/order/1041` and read someone else's order | Needs **two test accounts**. With one account, request the other's resource. Without both accounts the test is inconclusive, not negative. Guide: [`guides/idor.md`](../provensec-app/guides/idor.md) | Ownership check on the server, on every read and every write. Opaque IDs help and do not replace the check |
| **A07** | Permission checked only in the front end: the button disappears, the route still answers | Call the endpoint directly, without the screen. Guide: [`guides/function-level-authorization.md`](../provensec-app/guides/function-level-authorization.md) | Authorization on the server. The front end decides what to show, never what is allowed |
| **A08** | The API response returns fields the screen does not use: password hash, someone else's email, documents | Read each endpoint's raw response and compare with what the screen shows | Return only the fields the screen consumes. Select, do not return the whole record |
| **A09** | Update saves the whole request body: the user sends `"role": "admin"` along with the name and becomes admin | Send a field the screen does not send, like `role` or `balance`, and see if it persists. Deeper guide (Strix): [`mass_assignment.md`](https://github.com/usestrix/strix/blob/main/strix/skills/vulnerabilities/mass_assignment.md) | An explicit list of what the endpoint accepts. Fields outside the list are dropped, not silently ignored |
| **A10** | A list endpoint returns the whole base when you enumerate | Walk the ID parameter from 1 to N and count what comes back. Guide: [`guides/idor.md`](../provensec-app/guides/idor.md) | Owner filter on the server, and a page limit the client cannot raise |
| **A40** | Two simultaneous requests pass the same check: a single-use coupon works twice, a balance is withdrawn twice | With a test account in staging, fire the same action several times in parallel and count how many were accepted. Deeper guide (Strix): [`race_conditions.md`](https://github.com/usestrix/strix/blob/main/strix/skills/vulnerabilities/race_conditions.md) | Check and write happen together in the database: unique constraint, locking transaction, or conditional decrement |
| **A43** | The business rule lives only in the UI: a negative quantity becomes credit, the payment step is skipped by calling the next step directly | Call each step of the flow out of order and with unexpected values. Deeper guide (Strix): [`business_logic.md`](https://github.com/usestrix/strix/blob/main/strix/skills/vulnerabilities/business_logic.md) | The server checks the flow state and recomputes price and total, never trusts what the screen sent |

---

## Level 2: user input becomes code

| # | What breaks, in practice | How to test | What to do |
|---|---|---|---|
| **A11** | SQL query built by concatenation: the search box becomes a database command | Send a single quote in a field that feeds a search and see if a database error shows | Parameterized queries, always. An ORM is no exemption: a raw fragment inside it has the same defect |
| **A12** | User content rendered as raw HTML: one user's comment runs as script in everyone's session | Post content with an `<img onerror=...>` and see if it runs | Escape by default when rendering. If HTML is needed, sanitize with a library, not a regex |
| **A13** | Upload with no validation: anything, any size, and the file is publicly servable | Upload a file with a swapped extension and a very large file | Validate the real type (not the extension), size and count. Store outside the public root and serve through a controlled route |
| **A14** | No input validation on the server: whatever passed the screen is accepted as truth | Call the endpoint directly with the field empty, negative, huge and with the wrong type | A validation schema on the server for every endpoint. The front end validates for UX, the server validates for real |
| **A35** | The server fetches any address the user sends (link preview, image by URL, webhook): the app becomes a bridge to the internal network and to cloud credentials | Read the code: every server-side fetch with an address coming from the user. Is there a list of what may be fetched? | Explicit allowlist of destinations, block internal and cloud-metadata addresses after resolving the name, and do not follow redirects blindly |
| **A37** | A user-supplied file name builds the path on disk: the download reads files outside the intended folder | Read the code: every `readFile`, `sendFile` or download with a name from the request | Indirect reference (the user sends an id, the server picks the file), and a check that the final path stays inside the folder |
| **A42** | An app with AI obeys instructions hidden in content it reads (email, web page, uploaded document): the AI leaks data or takes actions the user did not ask for | List what the app's AI can do on its own (tools, sending, reading other users' data) and what it reads from external sources | External content treated as data, tools with minimum power, and human confirmation before any irreversible action |

---

## Level 3: accounts and sessions

| # | What breaks, in practice | How to test | What to do |
|---|---|---|---|
| **A15** | Passwords in plain text or with a weak hash: one database leak hands over every account, and accounts on other services too | Look at the password column. Can you read it? Plain text. See `md5`/`sha1`? Weak hash | A strong salted hash, using the algorithm your framework recommends today. Never reversible encryption |
| **A16** | Session token in `localStorage`: any XSS reads it and takes the session | Open the browser console and read `localStorage` while logged in | `HttpOnly`, `Secure` and `SameSite` cookie. ⚠️ Moving it without fixing A12 trades one problem for another: the cookie blocks reading by script and opens CSRF, which `SameSite` closes |
| **A17** | A token that never expires: whoever grabbed it once is in forever | Keep a token, wait, and use it later. Does it still work? | Short-lived access token, separate refresh, and revocation on logout and password change |
| **A18** | No rate limit on login, second factor and password recovery: try until it works | Fire wrong attempts in a row and see if any barrier appears | Limit per account **and** per origin, with progressive delay. Per-origin blocking alone falls to a proxy |
| **A19** | Sign-up without email verification: fake accounts in bulk, and password recovery to an address that is not the person's | Sign up with an address that does not exist and see if the account is active | Confirmation link before the account is enabled |
| **A20** | No password strength rule or breach check: the chosen password is already on a public list | Try to sign up with `123456` | Minimum length, and a check against a breached-password database. Mandatory symbols hurt more than they help |
| **A21** | Admin account without a second factor | Look at the admin account's security options | Second factor mandatory for admins, optional for everyone else |
| **A38** | Login token checked halfway: the server reads it without checking the signature, accepts any algorithm, or takes the role from a field the user edits | Change one character of the signature and resend. Did you get a 401?. Deeper guide (Strix): [`authentication_jwt.md`](https://github.com/usestrix/strix/blob/main/strix/skills/vulnerabilities/authentication_jwt.md) | Verify with a fixed algorithm, a long secret that comes only from the environment, and the role read on the server |
| **A39** | Another website acts as the logged-in user: change the email, delete an item, buy | Read the session cookie's `SameSite` and look for state changes over GET. Deeper guide (Strix): [`csrf.md`](https://github.com/usestrix/strix/blob/main/strix/skills/vulnerabilities/csrf.md) | `SameSite` on the cookie, no state change over GET, anti-CSRF token where the cookie must be `None`, current password to change email or password |

---

## Level 4: abuse, cost and exposure

Needs someone who wants in. It hurts your wallet, reputation and time, and rarely the data.

| # | What breaks, in practice | How to test | What to do |
|---|---|---|---|
| **A22** | No rate limit on public and expensive endpoints: one person generates thousands of requests and the cloud bill follows | Fire the most expensive endpoint in a row and see if any barrier appears | Limit per origin and per account at the edge, and a spending cap with alerts at the provider |
| **A23** | No bot protection on public entry points: sign-up and forms fill with junk | Submit the form several times in a row, with no interval | A challenge on public entry points, and a barrier at the edge before the app |
| **A24** | CORS open to any origin: another site calls your API with your user's session | Read the response header. Is it `*`? | An explicit origin list. `*` only on an API that is public on purpose and has no session |
| **A36** | Open redirect: the link on your domain (`?next=`) sends the person to a fake site, carrying your brand's trust | Swap the return parameter's destination for an outside domain and see if the app goes there | Accept only internal paths (starting with `/` and not `//`), or a name from a list the server translates |
| **A41** | GraphQL API open in production: the whole API map is public, and a nested query brings the server down | Check whether introspection answers in production, and whether there is a depth limit | Introspection off in production, depth and cost limits per query |
| **A25** | Webhook without signature check: anyone posts a fake "payment approved" event | Post to the webhook endpoint without a signature and see if it is processed | Validate the provider's signature before processing, and reject what does not match |
| **A26** | No security headers: the page opens inside a third-party iframe and clicks get hijacked | Read the page's response headers | `Content-Security-Policy`, `X-Frame-Options` or `frame-ancestors`, `X-Content-Type-Options`, `Strict-Transport-Security` |
| **A27** | Stack trace in production: the error shows file paths, library versions and sometimes credentials | Force an error and read the response | A generic message to the user, details only in the server log |
| **A28** | Vulnerable or outdated dependency | `npm audit` (in ProvenSec: `--dependencies`). ⚠️ Separate **reachable** from **present in the tree**: a CVE in a package your code never calls is not the same urgency | Update what is reachable first. A 200-item list teaches people to ignore the list |
| **A29** | HTTPS not enforced, or living alongside the plain `http` version | Open with `http://` and see if it redirects | Permanent redirect and `Strict-Transport-Security` |
| **A30** | Database credential with more privilege than the app needs | Check the role the app connects with | A least-privilege role: the app does not need to drop tables |
| **A31** | Sensitive data unencrypted at rest: documents, addresses, health data | Read the column directly in the database | Encrypt the sensitive field, and decide on paper what is sensitive before deciding how to store it |
| **A32** | No access and error logging: you do not discover the breach, you discover its consequence | Look for where denied accesses and errors from the last month are stored | Authentication, error and denied-access logs, with retention. **It is not what stops the attack, it is what lets you know there was one** |
| **A34** | Protection configured for one platform while the app runs on another: the code calls the check, the check cannot work there, and the team's report says it is protected | Look for the endpoint the protection depends on **on the production domain**. Does it answer 404? The call exists and the infrastructure does not. Confirm with a controlled test in staging, never against production | Either move back to the platform that supports the protection, or swap it for one that works where you host. **A protection that fails open is worse than none**, because it removes the question |
| **A33** | No tested backup: the damage stops being about security and becomes data loss | Restore a backup in a separate environment. Never restored? You do not have a backup, you have a file | Automatic backups, and a restore tested with a date |

---

## Where these came from

The first 34 items came from deduplicating nine public videos and posts on securing
apps built with AI, re-ordered by damage and effort, with a "how to test" column added to
every one of them. A32 and A34 came from real audits. A35 to A43 came from the VibeSec
skill and the Strix knowledge base (both Apache 2.0), for the classes the first
material did not cover.

| Level | 0 | 1 | 2 | 3 | 4 | Total |
|---|---|---|---|---|---|---|
| Items | 5 | 7 | 7 | 9 | 15 | 43 |
