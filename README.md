# Reachel Schedule - v0.3.2

<!-- historian-overview:start -->
## Project overview

| Field | Project |
|---|---|
| Purpose | Screenshot-to-reviewed-calendar schedule application. |
| Status | Implemented application; current deployment and acceptance limits are recorded below. |
| Owner | Repository: TheIlluminate92. Worker: Unassigned; project worker not recorded. |
| Continue here | [Current work / guidance](CHECKLIST.md) · [Checks / context](UPGRADING.md) |
| Related projects | Independent scope; no related repository is designated here. |

Documentation reviewed October 27, 2026. Existing evidence dates below still apply;
this overview is not a new release, deployment or live-system verification.
<!-- historian-overview:end -->

A small, self-hosted phone page for sending an HCA Timpani screenshot to
OpenAI, reviewing the extracted work nights, and adding missing shifts to
**Reachel Test**. It has no package dependencies and runs on Node.js 24.

## Current status

Implemented: image upload to the Responses API; blue-dot extraction prompt;
editable review; manual confirmation; existing-event checks; fixed Google
Calendar destination; signed-in access; Docker configuration.

Verified with automated, offline checks: Chicago daylight-saving transitions,
month/year rollover, old and new event-title matching, duplicate and concurrent
submissions, uncertain writes, authentication/CSRF, image byte forwarding,
structured response handling, Google JWT signing, and paginated calendar reads.
Provider responses in these tests are fixtures.

**Current deployment — November 3, 2026:** R730 Operations completed the
owner-approved LAN cutover at **22:10:48 CST** (November 4, 04:10:48 UTC).
Open **http://192.168.2.2:3081**. The saved template and active container publish
only **192.168.2.2:3081 → 3080/tcp**; internal `PORT=3080` is unchanged and
`PUBLIC_URL`, WebUI and icon URL match the new origin. The same running image
was retained without a pull. Private configuration and credentials were
preserved. This was a network configuration change, not a new app release.

Host health/page/icon checks returned 200; unauthenticated status returned 401.
Wrong-origin login and cross-site requests were rejected. Windows-client
health/page/status checks at **22:11:00 CST** also returned 200/200/401.
Successful password login, an issued cookie, authenticated CSRF flow, phone
acceptance and screenshot/provider/calendar behavior were **not tested** in this
cutover. Sign in again: recreation cleared prior sessions. HTTP is unencrypted;
the intended phone subnet and home-only access remain unverified. No firewall,
NAT, DNS, NPM or public-access change was made. See
[CHECKLIST.md](CHECKLIST.md) for acceptance limits and
[UPGRADING.md](UPGRADING.md) for old-URL behavior and scoped rollback.

**Earlier acceptance history — October 2026:** a real Timpani screenshot was
parsed and reviewed, and the user reported the app's functions worked. The
GitHub-built v0.3 deployment's health and six public assets were verified.
v0.3.1 simplified the icon; v0.3.2 added explicit shutdown handling and a timed
Docker stop check. These earlier observations do not establish a new successful
calendar import, phone acceptance, Docker-page icon refresh or deployed image
revision for the November 3 cutover.

This version uses a home-screen shortcut and file picker. Native Android/iOS
**Share → Send Schedule** is a later step after the phone platform is known.
It does not automatically delete or edit previously imported shifts; schedule
corrections need explicit review. Green-only dates never authorize deletion.

## Schedule rules

- Blue dot: scheduled work night. Green dot: ignore. Both dots: count blue.
- Date is the night the shift starts, not the following morning.
- Start 6:30 PM; end 7:00 AM the following day; America/Chicago timezone.
- New title defaults to **Reachel**, matching recent calendar entries. Change
  `SHIFT_TITLE` to `Reachel Night Shift` if desired.
- Existing **Reachel** and **Reachel Night Shift** entries with identical times
  are skipped. A different time on the same night is flagged, not overwritten.
- Destination is the known **Reachel Test** calendar ID in `core.mjs`. The
  browser cannot change it to a primary/personal calendar.
- Always review dates against the original screenshot. AI can misread colors
  or grid positions even when it produces valid structured JSON.

## 1. Get the OpenAI key

1. Sign in at https://platform.openai.com/api-keys.
2. Create a project API key (for example, name it `Reachel Schedule`).
3. Enable API billing if necessary:
   https://platform.openai.com/settings/organization/billing/overview.
4. Put the key in the server's `.env` as `OPENAI_API_KEY=...`. Do not put it
   in `public/`, a screenshot, Git, or a chat message.

For a Restricted key, give Model capabilities / Responses (`/v1/responses`)
Write/Create access. Leave other endpoints at None. Read-only cannot submit
a parsing request. Use a vision-capable model available to your API project. Do not use an
organization admin key. ChatGPT subscription billing is separate from API
billing.

## 2. First parsing test on a computer with Node.js 24

Extract this directory, open a terminal inside it, and run:

```text
npm run setup
```

Open the newly created `.env` locally. It contains a randomly generated app
password and signing secret. Set `OPENAI_API_KEY`, and keep
`PUBLIC_URL=http://localhost:3080`. Leave
`GOOGLE_APPLICATION_CREDENTIALS` blank for this first test.

```text
npm start
```

Open **http://localhost:3080** in that computer's browser. Sign in using
`APP_PASSWORD` from `.env`, select the screenshot, and click **Read my schedule**.
Compare every extracted date to the blue dots. Green dots must not appear.
Google setup is not needed to run this parsing test, and saving remains
disabled until credentials are configured. After `.env` changes, restart the
server.

For a UI-only example, set `DEMO_MODE=1` and restart. The example is clearly
marked **synthetic**; no screenshot is analyzed and no calendar calls occur.
Set it back to `0` for a real image test. No service worker or offline mode is
included.

## 3. Unraid / Docker

### GitHub-built image and normal Unraid updates

The app image is `ghcr.io/theilluminate92/reachel-schedule:latest`. GitHub
Actions tests and publishes it on pushes to `main`. Existing installations
using `node:24-alpine` need the one-time migration in [UPGRADING.md](UPGRADING.md)
before Unraid's Update action can update the app. Preserve `/config` and all
credentials; remove the old `/app` mapping so it cannot hide the image's files.
The image stays private unless its owner explicitly changes package visibility.
The Docker icon is available at `/docker-icon.png` after starting this image.

### Original local-source installer (existing installation reference)

The package includes `install-unraid.sh`. Run it as root from the extracted
package directory on Waz-Server. It installs **only a new Reachel-Schedule
container**, uses the official `node:24-alpine` image, saves the normal user
template, and exposes a masked **OpenAI API Key** field in Docker → Edit.
It refuses to overwrite an existing container, template, or app directory.

Default app directory: `/mnt/cache/appdata/reachel-schedule`; host TCP port
3080; detected private LAN IPv4 address. No DNS or proxy changes are made.
For another free port/IP, set `REACHEL_PORT` / `REACHEL_HOST_IP` before running.

#####
```bash
bash install-unraid.sh
```
#####

After installation: **Docker → Reachel-Schedule → Edit → OpenAI API Key →
Apply**. The same form holds the generated **App Password**; reveal or replace
it to sign into WebUI. Keep Google Credential File blank for the initial image
test. The local HTTP URL is for a trusted private LAN; use HTTPS/NPM for use
outside that LAN. Masking hides the key on screen but does not encrypt Unraid's
saved template or Docker configuration.

This template runs as Unraid nobody/users (`99:100`), with the application
mounted read-only at `/app` and configuration at `/config`. Later, put the
service-account JSON at `/mnt/cache/appdata/reachel-schedule/config/secrets/google.json`
(readable by UID 99) and set **Google Credential File** to
`/config/secrets/google.json`. The alternate Dockerfile/Compose instructions
below use UID 1000 instead and are optional.

### Alternate Dockerfile / Compose installation

Suggested install directory: `/mnt/user/appdata/reachel-schedule`.
Extract the whole package there. These commands run from that directory and
do not modify any existing container.

#####
```bash
cd /mnt/user/appdata/reachel-schedule
docker run --rm -v "$PWD:/app" -w /app node:24-alpine node setup.mjs
```
#####

Edit `.env` locally. For phone access through your existing Nginx Proxy Manager:

- Set `PUBLIC_URL=https://YOUR-CHOSEN-HOSTNAME` (no subpath).
- Set `BIND_ADDRESS` to the Unraid host's actual LAN IP, so NPM can reach it.
  The default `127.0.0.1` binding is intentionally local-only.
- Set `OPENAI_API_KEY` and leave `DEMO_MODE=0`.
- Set an app password for her phone. Preserve `APP_SECRET`; sign in again after
  restarting or updating the app.
- In NPM, forward the chosen HTTPS hostname to the Unraid LAN IP, port `3080`,
  HTTP upstream. Use your normal valid HTTPS certificate. This package does
  not change DNS, proxy, firewall, or port-forward settings.

Then, with Docker Compose available:

#####
```bash
docker compose up -d --build
```
#####

If using Unraid's Docker template instead, build the image locally:

#####
```bash
docker build -t reachel-schedule:0.2 .
```
#####

Use repository `reachel-schedule:0.1`, container port `3080`, and the same
environment-variable names from `.env.example`. Set the host port/IP to match
your proxy route. Mount the service-account JSON read-only once Google setup
is ready. The image runs as UID/GID `1000:1000`; credential-file permissions
must permit that user to read it. No browser-facing key entry is included.

On her phone, open the HTTPS page, sign in, and use **Add to Home Screen**.
Her normal workflow is: icon → choose screenshot → read → review → add shifts.

## 4. Give this app access to Reachel Test

The standalone app uses a Google service account so her phone never needs
your Google login. Configure it only after the image parsing test succeeds.

1. In https://console.cloud.google.com/, create/select a project and enable
   **Google Calendar API**.
2. Create a service account under **IAM & Admin → Service Accounts**.
   It does not need a Google Cloud project IAM role or domain-wide delegation
   for access to this explicitly shared calendar.
3. Create/download a JSON key for that service account. Keep it private.
4. In Google Calendar, open **Reachel Test → Settings and sharing → Share with
   specific people or groups**. Add the service account's `client_email`, with
   **Make changes to events** permission. Share this calendar only.
5. Save the JSON locally as `secrets/google.json`. For Docker, uncomment the
   read-only mount in `compose.yaml`, grant container UID 1000 read access to
   that file, and set
   `GOOGLE_APPLICATION_CREDENTIALS=/run/secrets/google.json` in `.env`.
   For a local Node process, use the file's absolute local path instead.
6. Restart/recreate the container. Upload the schedule, then use **Check for
   existing shifts** to verify live read access before adding anything.
7. Only after reviewing the dates, tick the confirmation and select
   **Add shifts to Reachel Test**. Inspect the results in Google Calendar.

The service account obtains short-lived access tokens in memory. The key file
must remain available; it is never sent to the browser or printed in logs.
Google provider policy or external-sharing restrictions can prevent sharing;
that must be resolved with the calendar/account owner, not bypassed.

## Configuration and operational limits

| Variable | Use |
| --- | --- |
| `OPENAI_API_KEY` | Server-only image-reading key |
| `OPENAI_MODEL` | Vision + Structured Outputs model; default `gpt-6.1-sol` |
| `PUBLIC_URL` | Exact browser origin; HTTPS outside localhost/private LAN IPs |
| `APP_PASSWORD` | At least 12 characters; shared app login |
| `APP_SECRET` | At least 32 characters; signs session cookies |
| `GOOGLE_APPLICATION_CREDENTIALS` | Local/container path to service-account JSON |
| `SHIFT_TITLE` | Default `Reachel` |
| `MAX_PARSES_PER_DAY` | Default 20, in memory per UTC day; restart resets it |
| `DEMO_MODE` | `1` uses synthetic example and disables live provider calls |
| `BIND_ADDRESS` | Compose host binding; default loopback |
| `PORT` | Node listen port; leave 3080 with the supplied Compose mapping |

Sessions last up to 90 days or until logout or an app restart, and use
HttpOnly/SameSite cookies, plus Secure over HTTPS. Logout revokes that session
server-side; every restart or update requires fresh login on all phones.
Requests already accepted before logout may finish. Failed logins are rate
limited by direct peer IP; behind NPM, that shared proxy IP shares the limit.
Request origins and CSRF tokens are checked on writes. No screenshot bytes
are persisted, but OpenAI processes the image under your API account's data
controls (`store:false` is set; it is not a zero-retention guarantee).

Upload limit: 10 MB; PNG/JPEG/WebP. Review supports up to 62 work dates in a
63-day span. Daily parse quotas are a basic guard, not a billing hard cap.
The app sends no notifications or invitations. Existing calendar reminder
defaults can apply to new events. It does not remove duplicates that predate
the app, automatically reconcile removed work nights, or automatically repeat
uncertain writes. An **Unconfirmed** result requires checking Google Calendar.

## Verification

```text
npm test
```

Tests use the real request handler and explicit provider fixtures without
network sockets. They do not establish real screenshot accuracy or live
Google permissions. Keep the actual screenshot as the first acceptance test.

## Documentation used

- OpenAI image inputs: https://developers.openai.com/api/docs/guides/images-vision
- OpenAI Structured Outputs: https://developers.openai.com/api/docs/guides/structured-outputs
- API key handling: https://help.openai.com/en/articles/4936850
- Google service-account authentication: https://developers.google.com/identity/protocols/oauth2/service-account
- Google Calendar event creation: https://developers.google.com/workspace/calendar/api/v3/reference/events/insert
- Calendar list/filter semantics: https://developers.google.com/workspace/calendar/api/v3/reference/events/list


## Home Wi-Fi deployment

The applied November 3 deployment is **http://192.168.2.2:3081**, bound to that
IPv4 host address and mapped to the app's internal port 3080.
Do not add public DNS, a reverse proxy, tunnel, or router port forward for this
app. LAN/VPN reachability depends on your network firewall and VLAN rules; the
app itself does not enforce Wi-Fi membership. HTTP is unencrypted even on a
private LAN, so use it only on a trusted network; HTTPS is better if available.

Keep the app password. Any device that can reach the app still needs it to use
paid parsing or calendar operations. The login lasts up to 90 days or until
logout or an app restart. Clearing
APP_PASSWORD prevents startup; passwordless access is not implemented.

For Unraid, put the downloaded Google key at
`/mnt/cache/appdata/reachel-schedule/config/secrets/google.json`, owned by
`99:100` with mode `600`. Set **Google Credential File** in Docker Edit to
`/config/secrets/google.json`, then Apply. Only share Reachel Test with the
service account, using **Make changes and see event details** (older wording:
**Make changes to events**). Do not grant manage-sharing permission.

On her phone, open the configured LAN URL, sign in, and add a home-screen
shortcut. File-picker upload works without a native Share target. An HTTP
shortcut may open in a browser rather than install as a full PWA.

## Updates and acceptance checks

See [UPGRADING.md](UPGRADING.md) for an existing Unraid installation and
[CHECKLIST.md](CHECKLIST.md) for the live checks still needed.
See [SECURITY.md](SECURITY.md) for credential handling and access limitations.
The v0.2 theme changes the page, icon, and manifest only; calendar rules,
authentication requirements, and the destination remain the same.

## v0.3 appearance and everyday use

The emblem blends a stylized anatomical heart, stethoscope, ECG trace, steel
spikes, crescent moon, and witch hat. It is decorative, not a clinical diagram.
The phone page calls the destination My night shifts; the server still uses
only Reachel Test. Connection/debug information is omitted from the everyday
page; configuration presence remains available via authenticated /api/status.
Review and conflict notices remain visible. No automatic calendar deletions
were added. To re-test missing dates, remove only the intended events yourself,
then preview and check that those dates are new before confirming an import.

