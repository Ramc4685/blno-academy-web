# BLno Badminton Academy Portal

Static, read-only member portal for GitHub Pages with a Google Apps Script Web App backend that reads the existing academy Google Sheet.

## Files

- `index.html` signs users in with Google and routes by backend role.
- `parent.html` and `parent/history/` show kid status, dues, attendance, and monthly history.
- `coach.html` and `coach/payslip/` show coach rosters and payout history.
- `admin.html`, `admin/dues.html`, `admin/sessions.html`, and `admin/coaches.html` show admin views.
- `AppsScript.gs` is the read-only API layer to paste into the existing Apps Script project.
- `js/config.js` stores public frontend configuration.

## Configure Frontend

Edit `js/config.js`:

```js
window.BLNO_CONFIG = {
  GOOGLE_CLIENT_ID: "your-web-oauth-client-id.apps.googleusercontent.com",
  BACKEND_URL: "https://script.google.com/macros/s/AKfy.../exec",
  DEFAULT_MONTH: "May-2026",
  ACADEMY_NAME: "BLno Badminton Academy"
};
```

The OAuth Client ID is public. Do not put a client secret in this site.

## Configure Apps Script

1. Open the existing Sheet: `1kc8KTKXM2jBJIkXeEZoyBXHQ7fVfMYb3EiqkHJtOwAg`.
2. Go to `Extensions -> Apps Script`.
3. Keep your existing large `Code.gs` automation file. Do not replace it.
4. Add a new Apps Script file named `WebApi.gs`.
5. Paste the contents of `AppsScript.gs` from this repo into `WebApi.gs`.
6. In `Project Settings`, enable `Show "appsscript.json" manifest file in editor`.
7. Open `appsscript.json` and make sure these scopes are present:
   - `https://www.googleapis.com/auth/spreadsheets`
   - `https://www.googleapis.com/auth/script.external_request`
   - `https://www.googleapis.com/auth/script.container.ui`
   - `https://www.googleapis.com/auth/script.scriptapp`
8. Update:
   - `BLNO_API.expectedClientId`
   - `BLNO_API.coachEmails`
   - `BLNO_API.adminEmails` if needed
9. Save the project.
10. Select `blnoAuthorizeWebApiServices_` from the function dropdown and click `Run` once. Approve permissions.
11. Deploy with `Deploy -> New deployment -> Web app`, or edit the existing deployment and create a new version.
12. Set `Execute as: Me`.
13. Prefer access `Anyone`. The API still verifies every Google ID token itself. If your Google Workspace only allows `Anyone with Google account`, the frontend includes an Apps Script-compatible JSONP fallback.
14. Paste the deployment URL into `js/config.js`.

Apps Script runs all `.gs` files in one project together. Your existing automation file provides the Sheet menu and repair tools; the added `WebApi.gs` provides the `doGet(e)` endpoint for the website.

The API file is intentionally much smaller than your automation file because it only handles authentication, role filtering, and read-only JSON endpoints.

Only one `doGet(e)` function can exist in the project. Your pasted automation file does not define `doGet`, so this API file can be added safely.

`ContentService` does not provide a supported API for arbitrary custom CORS headers. This implementation uses a read-only `GET` Web App endpoint returning JSON, which is the standard Apps Script pattern for browser-facing static sites.

## Local Review

No build step is required. Run a local server from the repo root:

```bash
python3 -m http.server 8080
```

Open `http://localhost:8080`.

Google sign-in only works if `http://localhost:8080` is listed as an authorized JavaScript origin on the OAuth client. GitHub Pages needs its own deployed origin added too.

## GitHub Pages

1. Push this folder to a repository, for example `blno-academy-web`.
2. In GitHub, open `Settings -> Pages`.
3. Use `main` branch and `/ (root)`.
4. Add the GitHub Pages URL as an authorized JavaScript origin in Google Cloud Console.

## API Actions

The Apps Script `doGet(e)` supports:

- `action=me`
- `action=parent_kids`
- `action=coach_roster&month=May-2026`
- `action=admin_dashboard&month=May-2026`
- `action=admin_dues`
- `action=admin_sessions&month=May-2026`
- `action=admin_coaches&month=May-2026`

Each request includes `id_token=<google_id_token>`. Apps Script verifies the token with Google, checks the audience against `BLNO_API.expectedClientId`, then maps role by admin email, coach email, or parent email in `Roster!E`.

## Notes

- The frontend does not recompute tuition, proration, or dues. It displays values returned by Apps Script from the Sheet.
- Parent results are filtered server-side by verified email.
- Coach results are filtered server-side by allowlisted coach email.
- Admin-only endpoints require `BLNO_API.adminEmails`.
- Apps Script logs every call with timestamp, verified email, and action via `console.log`.
