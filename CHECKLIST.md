# Live acceptance checks

These are manual checks, not claims of completed validation. Offline tests use
provider fixtures and do not contact OpenAI or Google.

## Earlier recorded status — October 2026

- Original version installed on Unraid and started successfully.
- Real screenshot reached OpenAI and produced a review list.
- Google service-account JSON key downloaded by the user.
- Live Google read access and event creation have not been verified here.
- The GitHub-built v0.3 image was deployed through Unraid's native updater;
  health and all six served assets matched the release. The Docker page still
  showed its question-mark fallback despite a valid PNG response.
- v0.3.1 simplifies the emblem to a witch hat, crescent moon and small heart.
  Its Unraid image update, phone check and targeted icon-cache repair are pending.
- v0.3.2 adds explicit shutdown handling and a clearer scheduling tagline. Its
  container stop timing is checked in Linux CI; Unraid update timing remains
  a separate live check.

## Applied LAN cutover — November 3, 2026

Evidence supplied by R730 Operations: completed **22:10:48 CST**
(2026-11-04T04:10:48Z); Windows-client checks **22:11:00 CST**. These are the
original observation times, not a subsequent live audit.

- Current URL: **http://192.168.2.2:3081**; exact publication
  **192.168.2.2:3081 → 3080/tcp**, without active wildcard IPv4/IPv6 publication.
- `PORT=3080` unchanged; `PUBLIC_URL`, template WebUI and icon URL match 3081.
  Same image retained without pulling; private configuration and credentials
  unchanged. Only Reachel-Schedule was recreated.
- Host Docker state/health: running/healthy. GET health/page/icon: 200 each.
  Unauthenticated status: 401. Login POST with the former HTTPS origin: 403
  before password processing. New-origin logout without a session: 401;
  cross-site POST: 403.
- Independent Windows-client health/page/status: 200/200/401.
- Password/session/CSRF checks remain implemented. Cookie HttpOnly/SameSite=Lax
  and absence of Secure over HTTP were verified in code, not by acquiring a live
  session. Fresh login is required after recreation.
- Not tested: successful password login, an issued cookie, authenticated CSRF,
  phone layout/login, screenshot parsing, provider access or calendar operations.
  No credentials or provider/calendar calls were used for acceptance.
- Intended phone/client subnet and effective home-only isolation remain unknown.
  A denied Windows route-metadata read was not retried or bypassed. Server LAN
  membership and a successful desktop request do not establish phone reachability.
- No firewall/NAT/DNS/NPM/public-access changes. The old public URL was not
  probed; no redirect or proxy deletion is implied by the origin change.
- Recovery uses the retained stopped original container and private Operations
  template/image/config records. Raw backups stay off GitHub; see
  [UPGRADING.md](UPGRADING.md#november-3-lan-cutover-rollback).

## Check in this order

1. Open the app on her phone on home Wi-Fi. Sign in, reload, and confirm the
   session remains active. Check narrow-screen layout, date inputs, and buttons.
2. Check the purple/orange theme and witch-hat/moon/heart icon. Blue must still mean work;
   green must still mean ignored. Check that text and inputs are readable.
3. Confirm screenshot parsing works and the calendar check is available. In
   v0.3, connection configuration details are kept off the everyday phone page.
4. Upload a real Timpani screenshot. Check month, year, every blue dot, and any
   dates having both blue and green. Compare each extracted date to the image.
5. Exercise manual correction: add a missing date, edit a date, remove a date.
   Editing must clear the confirmation and previous existing-event status.
6. Select Check for existing shifts. Verify known Reachel / Reachel Night Shift
   events are identified. No calendar writes should happen during this check.
7. Review the actual intended new shifts and confirm before Add shifts. Check
   the resulting events in Reachel Test: 6:30 PM to next-day 7:00 AM Central.
   Do not create dummy events unless you intentionally want a test event.
8. Recheck the same schedule. Previously added events should now be existing,
   and another confirmed import should skip them. Check the personal calendar
   remains unchanged.
9. Restart the container and check login, credential-file readability, and
   existing-event detection again. Sign-in must be required after every restart.
   Sign out and confirm protected access is denied until signing in again.
10. Add the shortcut to her phone's home screen. From cellular with Wi-Fi off
    and VPN off, confirm the private LAN URL cannot be reached. This checks
    that route only; also inspect port forwards/tunnels separately if needed.

## Known limitations

No automatic deletion or correction of previously imported events; no native
phone Share target; no offline use; no per-user accounts; no permanent usage
database; no provider-backed visual test fixtures. Theme CSS has reduced-motion
support and no external fonts, analytics, or image services.

