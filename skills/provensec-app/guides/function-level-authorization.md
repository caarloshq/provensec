# An action that was not meant for you (function-level authorization)

> Adapted from `strix/skills/vulnerabilities/broken_function_level_authorization.md` (usestrix/strix, Apache 2.0), condensed. Catalog items: A03, A07.
> 🔴 Only against a target you own. Never against production without the owner saying so.

## What breaks, in practice

IDOR is about another person's resource; this is about an action your role should not be able to trigger: promoting a user, approving a refund, deleting an account, entering the admin panel. The screen hides the button from non-admins, but the route the button called still answers. A regular account calling the endpoint directly does what only an admin should (A07). In the extreme case, `/admin` opens for anyone who types the URL, without even asking for login (A03).

## Where to look

- Admin routes: `/admin`, `/api/admin/*`, `/dashboard/users`, management server actions. Open them in a private window and see if they render.
- Checks that live only in the client: `if (user.role === 'admin')` in the React component decides what to show, and the route handler does not repeat the check on the server.
- Next.js middleware that protects the page (`/admin`) but not the route handler (`/api/admin/promote`) it calls.
- Sensitive mutations: changing roles, approving, refunding, issuing credit, resetting a second factor, force-verifying someone else's email.
- Old routes that survived: `/api/v1/...` without the check that went into `/api/v2/...`.
- Exported server actions that do not check the caller: any client with a session can fire them, even without the button on screen.
- A `middleware.ts` whose `matcher` covers only pages and leaves `/api/*` out, or that trusts a role cookie the client can set.
- Supabase with the role check only in the component: the PostgREST or RPC call does not repeat the rule in a policy.

## How to test

Needs **two accounts**: a regular one and a privileged one (admin), in the same environment. Without the regular account to contrast, the result is `NOT VERIFIED`, not "negative".

1. Logged in as admin, map the sensitive actions. In DevTools' network tab, note the route, method and body of each admin button (e.g. `POST /api/admin/promote` with `{"userId":"...","role":"admin"}`).
2. Take the **regular** account's access token.
3. Fire the same admin request with the regular account's token:
   ```bash
   curl -s -X POST https://YOUR-APP/api/admin/promote \
     -H "Authorization: Bearer REGULAR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"userId":"REGULAR_ACCOUNT_ID","role":"admin"}'
   ```
   Did it return 200 and did the role change? A07 confirmed. Check the real effect: read the user afterwards and see whether `role` became `admin`.
4. Test the panel with no session at all (A03): open the admin route in a private window.
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://YOUR-APP/admin
   ```
   200 without a session cookie means an open panel.
5. Confirm that removing the client-side lock changes nothing on the server: a hidden button does not protect the route. The evidence is the direct call, not the screen.

## Variations and bypasses

| Trick | Why it defeats a naive check |
|---|---|
| GET changing state, or `X-HTTP-Method-Override` | The check sometimes covers only the action's "official" method |
| Legacy route (`/api/v1/admin`) that skipped the new middleware | The lock went into the new route and the old one stayed alive |
| Proxy identity headers (`X-User-Id`, `X-Role`) | If the backend trusts headers injected at the edge, you declare yourself admin |
| Change content type (JSON ↔ form ↔ multipart) | Different handler, different middleware, a check that exists in only one |
| Creating the job is allowed, but finalizing/approving does not check the caller | Authorization lives at creation and is missing at the step that applies the effect |
| Webhook or queued task that runs a privileged action without re-checking | The background worker trusts that whoever queued it had the right |

## What counts as evidence

To mark **CONFIRMED**: the regular account invoking the restricted action successfully (request and response), plus proof that state really changed (user promoted, refund issued, account deleted), read from a trusted source after the action, with before and after. Also show that the right account can do it and a third account without the right is blocked, to separate "everyone can" from "this role leaked".

False positives: a read endpoint labeled admin that is public by documentation, and a beta feature open to all roles by declared policy. A test environment where the admin action is mocked with no real effect is not evidence either, because nothing actually changed.
