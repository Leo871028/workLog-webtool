# Daily Work Log Export API

Authenticated Supabase Edge Function for exporting the signed-in user's saved `daily_logs`.

The existing GitHub Pages Export UI is unchanged. This API is an additional interface for external tools such as `curl`, Python, PowerShell, automation scripts, or other applications.

## Endpoint

```text
GET https://<PROJECT_REF>.supabase.co/functions/v1/export-log
```

Query parameters:

| Parameter | Required | Values |
| --- | --- | --- |
| `start` | Yes | `YYYY-MM-DD` |
| `end` | Yes | `YYYY-MM-DD` |
| `format` | No | `xlsx`, `csv`, `md`, `txt`, `json` (default: `csv`) |

Authentication:

```http
Authorization: Bearer <SUPABASE_USER_ACCESS_TOKEN>
```

The function validates the access token and queries `daily_logs` using the caller's authenticated Supabase session. Existing RLS policies remain in effect.

Do **not** use a `service_role` key as a client API token.

## Deploy

Install and authenticate the Supabase CLI, then from the repository root run:

```bash
supabase login
supabase link --project-ref <PROJECT_REF>
supabase functions deploy export-log
```

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided to hosted Supabase Edge Functions by the Supabase runtime.

## Example: curl

CSV:

```bash
curl -L \
  "https://<PROJECT_REF>.supabase.co/functions/v1/export-log?start=2026-09-01&end=2026-09-30&format=csv" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -o daily_work_log.csv
```

Excel:

```bash
curl -L \
  "https://<PROJECT_REF>.supabase.co/functions/v1/export-log?start=2026-09-01&end=2026-09-30&format=xlsx" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -o daily_work_log.xlsx
```

JSON:

```bash
curl \
  "https://<PROJECT_REF>.supabase.co/functions/v1/export-log?start=2026-09-01&end=2026-09-30&format=json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Example: Python

```python
import requests

url = "https://<PROJECT_REF>.supabase.co/functions/v1/export-log"
params = {
    "start": "2026-09-01",
    "end": "2026-09-30",
    "format": "csv",
}
headers = {
    "Authorization": "Bearer <ACCESS_TOKEN>",
}

response = requests.get(url, params=params, headers=headers, timeout=30)
response.raise_for_status()

with open("daily_work_log.csv", "wb") as f:
    f.write(response.content)
```

## Getting the access token in the web app

The application already signs in through Supabase Auth. From JavaScript using the existing Supabase client:

```js
const { data: { session } } = await db.auth.getSession();
const accessToken = session?.access_token;
```

Access tokens expire. External long-running integrations should use a proper Supabase Auth session / refresh-token flow rather than permanently storing an old access token.

## Responses

Successful file responses include:

```text
Content-Disposition: attachment; filename="daily_work_log_<start>_to_<end>.<format>"
X-Export-Count: <number of exported logs>
Cache-Control: no-store
```

Common error statuses:

| Status | Meaning |
| --- | --- |
| `400` | Invalid date range or format |
| `401` | Missing, invalid, or expired user access token |
| `404` | No saved logs in the requested range |
| `405` | HTTP method other than GET |
| `500` | Supabase query/runtime error |

## Security

- User identity comes from the Supabase access token.
- The API does not accept a caller-supplied `user_id`.
- The database query explicitly filters to the authenticated user's ID.
- Supabase RLS still applies.
- No `service_role` key is embedded in the function or frontend.
