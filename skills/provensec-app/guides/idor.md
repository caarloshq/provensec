# Someone else's object (IDOR / BOLA)

> Adapted from `strix/skills/vulnerabilities/idor.md` (usestrix/strix, Apache 2.0), condensed. Catalog items: A06, A10.
> 🔴 Only against a target you own. Never against production without the owner saying so.

## What breaks, in practice

You change a number in the URL or the request body, `/order/1042` becomes `/order/1041`, and you read (or change) another person's order. The server checks there is a valid session, but forgets to check whether that resource is yours. With a regular account, an outsider reads everyone's invoices, messages, documents and addresses. When the endpoint is a list (A10), one parameter walked from 1 to N returns the whole base.

## Where to look

- Routes with an identifier: `/api/order/[id]`, route handlers, server actions that receive an `id` and `select` without filtering by owner.
- Supabase with RLS off: `supabase.from('orders').select().eq('id', id)` without `.eq('user_id', session.user.id)`, or an RLS policy that only checks `authenticated`, not ownership.
- PostgREST directly: `GET /rest/v1/orders?id=eq.1041` with the anon key and the access token, bypassing your API.
- Relation fields in the body: `owner_id`, `account_id`, `org_id`, `tenant_id`, `team_id`.
- Expansion parameters that skip the check: `?include=`, `?expand=`, `?select=` (in PostgREST, `select=*,customer(*)` pulls the whole relation).
- ID seeders: search, list, export (CSV/PDF), notification and email endpoints often hand out valid IDs from other accounts.
- Storage: a signed Supabase Storage URL with another user's prefix, or a share link with a swapped token.

## How to test

Needs **two test accounts** in the same environment (account A and account B). Without both, the result is `NOT VERIFIED`, never "negative": you could not build the test, and that does not prove it is safe.

1. Log in with account A and account B. In DevTools, capture each one's access token (Supabase: `sb-<ref>-auth-token` in storage, or the request's `Authorization: Bearer`).
2. With account A, create a resource and note its ID (e.g. order 1042). Do the same with account B (order 1041).
3. With account A's token, request account B's resource. Reads first:
   ```bash
   curl -s https://YOUR-APP/api/order/1041 -H "Authorization: Bearer TOKEN_A"
   ```
   Did account B's order come back? A06 confirmed on read.
4. Repeat for writes and deletes (PATCH, PUT, DELETE): the bigger damage, and the one most often forgotten.
5. Test the list (A10): walk the parameter from 1 to N and count what comes back.
   ```bash
   for id in $(seq 1000 1010); do
     curl -s "https://YOUR-APP/api/order/$id" -H "Authorization: Bearer TOKEN_A" \
       -o /dev/null -w "$id %{http_code} %{size_download}\n"
   done
   ```
   IDs that are not account A's coming back 200 with a full-size response: the base is open.
6. If you use Supabase, test PostgREST directly, which bypasses your whole API:
   ```bash
   curl -s "https://<ref>.supabase.co/rest/v1/orders?id=eq.1041" \
     -H "apikey: ANON_KEY" -H "Authorization: Bearer TOKEN_A"
   ```
   Did a row from account B come back? RLS is not protecting you, and hiding the route in your API does not help.

## Variations and bypasses

| Trick | Why it defeats a naive check |
|---|---|
| Change the ID type (`{"id":123}` vs `{"id":"123"}`, array vs scalar) | A validator that checks one shape lets the other through |
| Duplicate JSON key (`{"id":1,"id":2}`) or repeated parameter (`id=1&id=2`) | Gateway and backend disagree on which one wins |
| Change content type (JSON ↔ form ↔ multipart) | Each parser goes through a different middleware |
| `X-HTTP-Method-Override`, or GET on an endpoint that changes state | Read routes sometimes have weaker checks than write routes |
| Trusting proxy headers (`X-User-Id`, `X-Tenant-Id`) | If the backend trusts the header, you rewrite who you are |
| Batch IDs: another account's ID in the middle of a large array | Bulk endpoints often check only the first item |
| Cache/CDN without `Authorization` in the key | One user's response is served from cache to another |

## What counts as evidence

To mark **CONFIRMED**: the request and response with account A's token reading or changing account B's resource, plus the same request done the right way (with the ownership check) returning 403 or an empty list. A before/after pair with both accounts identified, not a screenshot.

Watch for false positives: an empty array or `null` for the other account's resource is the protection working silently, not exposure. Compare with what the owning account sees on the same endpoint to know whether the data really disappeared or just left the response. A resource that is public by design (open profile, published post) is not IDOR either.
