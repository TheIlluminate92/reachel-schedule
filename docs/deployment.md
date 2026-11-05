# Reachel release, installed state and acceptance

Maintainer: Existing application worker for behavior; R730 Operations for host/runtime; Historian for guide structure.
Reviewed: 2026-11-05 (America/Chicago).
Status: documentation pilot; source and dated evidence, no runtime changes.

## Current installed state

R730 Operations applied the owner-approved LAN cutover **November 3, 2026 at
22:10:48 CST** (November 4 04:10:48 UTC), with Windows checks at 22:11:00 CST.
Browser address and `PUBLIC_URL`: **http://192.168.2.2:3081**.
Exact IPv4 host mapping: `192.168.2.2:3081 → 3080/tcp`; internal `PORT=3080`.
No active wildcard IPv4/IPv6 publication was accepted. WebUI/icon matched.

Existing image ID, retained without a pull:
`sha256:2a121d88ad61b5421ca86c9d6eeed5c9f8921381dbffd6d52d87937004368dfd`.
This is a local Docker image identity, not a claimed registry digest or proven
source-to-installed revision mapping. Source package 0.3.2 is a separate fact.

Configuration/credentials and five backed-up private files were preserved along
with resource/security controls. Only Reachel was recreated; brief interruption
was 22:09:31–22:10:48 CST. Beyond the app publication/origin change described above,
no firewall/NAT/DNS/NPM/public-access, provider or calendar change occurred.
[CHECKLIST.md](../CHECKLIST.md) owns the detailed original checks;
[UPGRADING.md](../UPGRADING.md) preserves migration and rollback history.

Operations' fresh **November 5 05:45:10 CST** management metadata saw the same image,
running/healthy, zero restarts, host 3081 to container 3080, `/config` RW and 512 MiB.
That limited read did not expose host binding IP, CPU pins, PID/security controls
or refresh login/provider/backup evidence. Those remain dated November 3 records.

## Acceptance scope

| Check | Accepted evidence / limit |
|---|---|
| Host page/health/icon | 200; November 3 cutover |
| Protected status, unauthenticated | 401 on host and Windows; expected rejection |
| Old-origin login / cross-site change | 403 rejection; not successful authenticated CSRF proof |
| New-origin logout, no session | 401; no issued cookie or login established |
| Windows page/health | 200 at 22:11 CST |
| Successful login, issued cookie/session and authenticated CSRF | Not tested |
| Phone/subnet isolation, screenshot parsing, providers/calendar | Not tested |
| Old public URL end-to-end behavior / full restore | Not tested |

## Future release ownership and gates

Application changes belong to the app role; Operations owns runtime/template and
recovery. Review source/tests, preserve human screenshot review, fixed destination,
duplicate/auth guards and private data exclusions. A pull request (PR) is a review
proposal; it is not an installed release.

**Every push to main, including docs, triggers `publish-image.yml` and image
publication.** This pilot updates existing **draft PR #4** only; do not merge it,
move main or dispatch publishing as a documentation check. PR checks run Linux
image/offline tests without publishing. A future authorized release tests/builds
the complete app, all six assets and graceful idle shutdown, then publishes private
GHCR `latest` plus `sha-<commit>` tags. A source commit and immutable image receipt
must be handed to Operations before a separately approved host update.

Keep the current 3081 origin/template when updating. The old Node-image `/app`
overlay migration and `install-unraid.sh` are historical/new-install procedures,
not instructions to recreate today's installation. Do not pull mutable latest,
replace private config with examples or regenerate credentials as routine recovery.
