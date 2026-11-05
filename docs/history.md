# Reachel decisions, history and remaining gaps

Maintainer: Existing application worker for behavior; R730 Operations for host/runtime; Historian for guide structure.
Reviewed: 2026-11-05 (America/Chicago).
Status: documentation pilot; source and dated evidence, no runtime changes.

The design keeps a human between uncertain image extraction and calendar writes.
The fixed Reachel Test destination prevents the browser from switching to a
personal calendar. Matching-event checks and deterministic IDs reduce duplicates;
different-time conflicts stay visible instead of being overwritten. The app
creates missing shifts only, leaving removal/editing to deliberate human review.

| Record | Meaning |
|---|---|
| [CHANGELOG.md](../CHANGELOG.md) | Application changes and dated deployment history |
| [UPGRADING.md](../UPGRADING.md) | Current 3081 deployment, session fix and explicitly historical original Node-image migration |
| [CHECKLIST.md](../CHECKLIST.md) | Applied November 3 cutover acceptance and untested paths |
| [SECURITY.md](../SECURITY.md) | Trusted-LAN/shared-password model, provider privacy and current security behavior |
| [Deployment guide](deployment.md) | Current-source versus installed-image distinction and November 5 bounded metadata |

The current LAN-only workflow needs no new public DNS, port forward, proxy or
tunnel. A private IP alone does not prove isolation: other VLAN/VPN/wired clients
may reach it if allowed by network policy. The intended phone subnet/isolation
remains unknown. HTTP was explicitly accepted and is plaintext; no stronger
transport claim is made. Sessions last up to 90 days or until logout/restart;
logout revokes only that session, restart clears all.

Known gaps remain successful installed login/issued cookie/authenticated CSRF,
phone acceptance, real screenshot/provider/calendar behavior, old-public-route
reachability, deployed-source parity and a full off-host restore demonstration.
No native mobile Share target/service-worker offline mode is implemented; a
home-screen shortcut/file picker is the existing flow. This guide does not revive
parked features or authorize any provider call.

## Artwork history

Current selected source uses the simple witch-hat/crescent/heart SVG and matching
Docker PNG, with a dark purple page. The earlier anatomical-heart/stethoscope/
ECG/spikes description is historical. Source inspection and local PNG inspection
establish asset contents, not phone rendering or deployed-source parity.

## 2026-11-05 — Documentation pilot

Historian reorganized entry navigation into tutorial, daily how-to, reference,
architecture, release and recovery guides in existing draft PR #4. Prior four-file
LAN cutover edits and evidence dates are preserved. The existing application chat
handed off documentation writing/review only; Operations supplied bounded host and
private recovery evidence. Main remains unchanged because its pushes publish images.
No app source, runtime, provider/calendar or credential change is part of this pilot.
The handbook links this repo instead of maintaining a second app configuration guide.
