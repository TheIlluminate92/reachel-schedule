# Use Reachel Schedule and handle problems

Maintainer: Existing application worker for behavior; R730 Operations for host/runtime; Historian for guide structure.
Reviewed: 2026-11-05 (America/Chicago).
Status: documentation pilot; source and dated evidence, no runtime changes.

## Add missing work nights

Prerequisites: approved access to the app on your trusted network, the existing
password, and an intended Timpani screenshot. Do not use a real screenshot merely
to test documentation. The selected image goes to OpenAI for parsing.

1. Open **http://192.168.2.2:3081** and sign in. Use the exact address, including
   port 3081. A port is the numbered service entrance on a host.
2. Choose the screenshot using the file picker. PNG, JPEG and WebP are supported,
   up to 10 MB. A home-screen shortcut can open the site; a native phone Share
   target is not implemented.
3. Set the year field if the screenshot does not show a year, then choose **Read my
   schedule**. Selecting a file alone does not parse it. Read and correct the proposed
   dates. Blue dots mean work; green-only dots are
   ignored; a blue-and-green day still counts as work. AI can misread colors or
   grid positions even if its response is valid.
4. Check existing shifts/conflicts. Each date means the **start night** of an
   18:30–07:00 next-day shift in America/Chicago. Review month boundaries carefully;
   daylight-saving time is handled by the app's zone-aware shift logic.
5. Explicitly confirm the intended missing shifts, then add them. Editing the dates
   invalidates the previous check/confirmation: check again before submitting.
6. Read the per-date outcome. Existing matching events are not added again.
   A different-time shift is a conflict, not permission to overwrite it. Inspect
   any **Unconfirmed** outcome directly in Calendar before retrying.

The destination is fixed to Reachel Test; the browser cannot choose a personal
calendar. New shifts use the configured `SHIFT_TITLE` (default Reachel; the installed
value was not inspected at cutover); matching older Reachel Night
Shift events are recognized too. No invitations are sent, but the calendar's
own reminder defaults can apply. Removed work nights require separate human review;
the app will not delete or reconcile them automatically.

## Troubleshoot without changing the server

| Symptom | What to check | Stop / expected result |
|---|---|---|
| Old bookmark fails or login rejected | Use the exact current 3081 origin | Do not change PUBLIC_URL, proxy or firewall yourself |
| Signed out after update | Sign in again; sessions are kept in memory | Restart invalidates all sessions; it is not proof the password changed |
| 401 on protected status without login | This is the expected authentication rejection | It proves neither successful login nor calendar access |
| 403 on an old-origin POST | The origin guard is rejecting it | Use the current URL; do not disable the guard |
| Wrong parsed dates | Correct every date and repeat the existing-shift check | Never confirm blindly; no model/settings change is implied |
| Conflict / Unconfirmed | Inspect the exact date in Calendar before further action | Do not retry blindly or delete existing events to clear it |
| App unreachable / repeated provider failures | Give Operations a sanitized time/error and current URL | Do not reinstall, reset secrets or restart as a first diagnostic |

Successful login, issued cookies, authenticated CSRF flow, phone acceptance and
provider/calendar function were **not tested** by the November 3 network cutover.
CSRF is protection against another site causing a logged-in browser to submit
changes. An unauthenticated rejection test is not a complete CSRF acceptance test.
Keep actual schedules/screenshots, passwords and environment dumps out of issues.
