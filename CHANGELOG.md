# Changelog

## Deployment history

### 2026-11-03 — approved R730 LAN cutover applied

- Completed by R730 Operations at **22:10:48 CST** (2026-11-04T04:10:48Z);
  Windows-client acceptance at **22:11:00 CST**.
- Browser origin and saved template changed to `http://192.168.2.2:3081`,
  with exact IPv4 publication `192.168.2.2:3081 → 3080/tcp`. Internal port,
  existing image, private configuration and credentials retained; no image pull.
- Recreated only the scheduler. No firewall/NAT/DNS/NPM/public-access or
  provider/calendar changes. Restarted sessions require fresh login.
- Health/page/icon and unauthenticated/origin rejection checks passed within the
  [recorded acceptance scope](CHECKLIST.md#applied-lan-cutover--november-3-2026).
  Successful live login/session/CSRF, phone access, intended client subnet,
  screenshot/provider/calendar behavior and old-public-URL behavior remain
  unverified. This documentation update repeats those original observation
  dates; it performs no new runtime checks.
- Retained original container and private template/image/config recovery records
  remain Operations-owned. See [scoped rollback](UPGRADING.md#november-3-lan-cutover-rollback);
  raw private recovery exports are not included in this repository.


## Unreleased

- Revoke signed-out sessions on the server so copied cookies cannot be replayed.
  Active sessions are held in memory: restarting or updating requires fresh login
  on all phones, including cookies issued by older versions. No new storage needed.
- Reserve screenshot parsing before reading the upload, reject overlapping
  requests, and release the reservation after success or any failure.
- Add real-handler regressions for cookie replay, other sessions, restarts,
  expiry, slow uploads, parser overlap, failure recovery, and daily limits.

## 0.3.2

- Changed the page tagline to “You work nights. Let’s make scheduling a little
  less work.”
- Handle SIGTERM/SIGINT explicitly: stop accepting requests, close idle HTTP
  connections and exit after active requests finish. This is intended to avoid
  idle stop-timeout waits; it does not shorten active calendar operations.
- Added a Linux shutdown regression test and a real Docker stop timing check.
  Publishing now requires the idle image to exit normally within four seconds.
- Unraid's full update duration is separate from app shutdown and remains
  unmeasured; registry, icon and container-recreation time may still contribute.

## 0.3.1

- Simplified the artwork to a purple witch hat, gold crescent moon and a small
  heart on the hatband. Removed the anatomical heart, stethoscope, ECG and spikes.
- Regenerated the matching 512px Docker PNG from the SVG and versioned the page
  asset URLs so browsers request the updated artwork.
- Documented native Unraid updates and a targeted icon-cache refresh for the
  Docker page's persistent question-mark fallback. No calendar/auth changes.

## 0.3.0

- Added a GitHub Actions build that tests and publishes the complete app to
  GitHub Container Registry for normal Unraid image updates, with commit tags
  for rollback and a documented one-time migration from the original Node image.
- Serve the genuine PNG at `/docker-icon.png` without login so Unraid can load
  the image's own Docker artwork instead of stale host-mounted files.

- Added a genuine 512px PNG for the Unraid Docker icon and changed new-install
  template/label settings to a local file URL; no dependency on the app server.

- Combined the witch theme with an anatomical heart, stethoscope, ECG line, and
  steel-colored spikes inspired by heavy-metal artwork. No flashing animation.
- Simplified the everyday upload/review/save copy and removed connection/debug
  details from the phone page. The actual calendar stays Reachel Test.
- Added versioned static-asset URLs to refresh the changed artwork and script.
- Kept date review, duplicate checks, conflict warnings, password requirements,
  screenshot privacy disclosure, and all backend behavior.


## 0.2.0

- Moonlit Halloween theme: purple panels, orange buttons, crescent moon and
  witch-hat artwork, serif headings, matching home-screen and Docker icon.
- Retained functional blue/green dot colors, review labels, and manual consent.
- Fixed corrupted display punctuation in the existing HTML and browser script.
- Documented Google JSON setup, home-Wi-Fi access, password/session behavior,
  live acceptance checks, safe theme upgrades, rollback, and credential handling.
- Expanded Git ignores to cover local configuration and common key files.
- No backend calendar or authentication changes.

## 0.1.0

- Initial screenshot parsing, editable review, fixed calendar destination,
  duplicate checks, signed login sessions, and Unraid Docker installation.

