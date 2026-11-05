# Reachel Schedule — start here

Maintainer: Existing application worker for behavior; R730 Operations for host/runtime; Historian for guide structure.
Reviewed: 2026-11-05 (America/Chicago).
Status: documentation pilot; source and dated evidence, no runtime changes.

Reachel Schedule turns a reviewed HCA Timpani screenshot into missing work shifts
in **Reachel Test**, a fixed Google Calendar destination. AI suggests dates; a
person must correct and confirm them. The app does not delete shifts, edit existing
events or reconcile removed work nights automatically.

| Goal | Guide |
|---|---|
| Learn safely on a development PC | [Offline tutorial](tutorial.md) |
| Sign in, review a screenshot and add shifts | [Daily use and troubleshooting](how-to.md) |
| Understand settings and sensitive files | [Configuration reference](reference.md) |
| Understand data flow and source modules | [Architecture](architecture.md) |
| Find the installed address, release gates and evidence | [Deployment](deployment.md) |
| Preserve or recover the app | [Backup and recovery runbook](recovery.md) |
| Understand earlier choices and known gaps | [History](history.md) |

Current installed address: **http://192.168.2.2:3081**. Sign in again after a restart.
The local development/Compose example uses **3080**; it is not the installed host
mapping. See [the dated acceptance checklist](../CHECKLIST.md). A running or healthy
container does not prove successful login, phone access, parsing or calendar writes.

Users choose screenshots and confirm dates. The application role maintains parsing,
validation and UI; R730 Operations owns host/template/backup/recovery. Historian
organizes the docs. The repository's earlier project-worker assignment remains
unassigned in its ownership record; this pilot does not invent a permanent owner.
Ask the owner to settle responsibility before a future app change if needed.

The source package is **0.3.2**. Do not infer the installed image's source revision
from that string: the November 3 LAN cutover preserved the existing image without
pulling an update. Read [SECURITY.md](../SECURITY.md) before connected setup.
