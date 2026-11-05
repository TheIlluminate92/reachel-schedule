# Reachel configuration and file reference

Maintainer: Existing application worker for behavior; R730 Operations for host/runtime; Historian for guide structure.
Reviewed: 2026-11-05 (America/Chicago).
Status: documentation pilot; source and dated evidence, no runtime changes.

Authoritative sources: [`.env.example`](../.env.example), `server.mjs`'s configuration
loader and [SECURITY.md](../SECURITY.md). These are source defaults, not a dump of
the installed private configuration. No separate configuration schema file exists.

| Setting | Source default / validation | Meaning |
|---|---|---|
| `PUBLIC_URL` | `http://localhost:3080`; plain HTTP(S) origin only, no path/query/userinfo/hash | Must match the browser's scheme, host and port. Nonlocal public hosts require HTTPS. Applied origin is `http://192.168.2.2:3081` |
| `PORT` | `3080`; integer 0–65535 | Node's internal listener; installed host port 3081 still maps to internal 3080 |
| `BIND_ADDRESS` | Compose default `127.0.0.1` | Compose host publication setting, not the Node listener configuration |
| `APP_PASSWORD` | Required; at least 12 characters | Shared household login; private |
| `APP_SECRET` | Required; at least 32 characters | Signs sessions; private. Restart clears sessions even if unchanged |
| `OPENAI_API_KEY` | Blank example | Server-side restricted provider credential |
| `OPENAI_MODEL` | `gpt-6.1-sol` | Current source default; no model change or cost recommendation is made here |
| `GOOGLE_APPLICATION_CREDENTIALS` | Blank example | File path to the protected Google service-account JSON key |
| `SHIFT_TITLE` | `Reachel` | Title for newly created shifts |
| `MAX_PARSES_PER_DAY` | `20`; integer 1–1000 | In-memory parse guard; restart resets it. Not a provider billing cap |
| `DEMO_MODE` | `0`; only `1` enables | Synthetic UI mode; real parsing and calendar writes blocked |

Direct `npm start` binds Node to `0.0.0.0` (all IPv4 interfaces). A localhost
`PUBLIC_URL` does not restrict that listener. Compose's default loopback host-port
publication is a separate network boundary; `BIND_ADDRESS` is not read by Node.
Do not launch a direct development/demo server assuming its URL makes it private.

The fixed destination is defined in `core.mjs`; use the **Reachel Test** alias in
documentation instead of reproducing its raw identifier. Calendar permissions,
not knowing that identifier, control access. Input review permits up to 62 dates
within a 63-day span. See [daily use](how-to.md) for shift semantics.

## Files and deployment contexts

| File / path | Purpose |
|---|---|
| `.env.example` | Sanitized development settings; never replace the installed private configuration with it |
| `.env`, private `/config`, service-account key | Private runtime values; exclude from Git, logs and issue attachments |
| `setup.mjs` | New local setup only; exclusive-create `.env`, mode 0600, random secrets without printing them |
| `compose.yaml` | Alternate local build recipe; loopback host 3080 by default, read-only root filesystem, dropped capabilities and temporary `/tmp` |
| `Dockerfile` | Node 24 Alpine app image; `/app` source baked in, default nonroot node user, internal 3080 and health check |
| `install-unraid.sh` | Historical new-install-only script; refuses an existing install, not the current upgrade procedure |
| `package.json` | Source package 0.3.2, Node >=24; `npm test`, `npm start`, `npm run setup`; no npm dependencies |

Docker mounts expose a host folder at a container path. The installed image uses
only `/config` read/write, with no old app-source overlay. Its reviewed native
runtime uses UID 99:100; the Dockerfile's default user is a separate context.
UID/GID are numeric operating-system user/group IDs. JWT (JSON Web Token) is
the signed assertion used to authenticate the Google service account. POSIX is
the Unix-style process/signal interface used by the Linux shutdown test.
File modes such as 0600 mean owner read/write only; preserve actual ownership
and modes rather than assuming a development recipe matches Unraid.

The app does not save screenshot bytes to disk and requests OpenAI `store:false`;
this is not a zero-retention guarantee. Dates/events go to Google after confirmation.
Provider data controls still apply. Cookies are HttpOnly and SameSite=Lax, with
Secure on HTTPS; current approved HTTP omits Secure and does not encrypt traffic.
