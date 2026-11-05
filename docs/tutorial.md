# Learn Reachel Schedule without provider accounts

Maintainer: Existing application worker for behavior; R730 Operations for host/runtime; Historian for guide structure.
Reviewed: 2026-11-05 (America/Chicago).
Status: documentation pilot; source and dated evidence, no runtime changes.

**Outcome:** understand the source and run invented-data tests without opening a
production service, sending a screenshot or creating a calendar event.

## Get a safe local copy

Use the existing GitHub account with access to the private
[`TheIlluminate92/reachel-schedule`](https://github.com/TheIlluminate92/reachel-schedule) repository.
If access is missing, stop and ask the owner; do not request new tokens or change sharing.
On its GitHub page, choose **Code → Download ZIP**, extract it with Windows
**Extract All**, and open the extracted `reachel-schedule-main` folder. If the ZIP has an
outer wrapper folder, continue until you can see `README.md` alongside the app files.
For the scheduler's pilot guides, select branch `docs/lan-cutover-20261103` before
downloading; its extracted folder name differs. Do not overwrite an existing checkout.

In File Explorer's address bar for that folder, type `powershell` and press Enter.
That opens PowerShell there; `Get-Location` shows the folder. The **checkout root**
means this top-level repository folder, not a production appdata folder.
Expect `README.md`, `server.mjs`, `package.json`, `public/` and `test/`.

If you already use Git, clone rather than downloading a ZIP:
`git clone --branch docs/lan-cutover-20261103 https://github.com/TheIlluminate92/reachel-schedule.git`.
See [GitHub's cloning guide](https://docs.github.com/en/repositories/creating-and-managing-repositories/cloning-a-repository).
A ZIP has source files but no local Git history. Either is enough for this tutorial.

Use the [official Node.js download page](https://nodejs.org/en/download) to install
an appropriate Node 24 development runtime on the PC if needed; reopen PowerShell
after installation and check `node --version`. Do not install or upgrade Node on R730.

## Before the exercise

Use a separate development checkout, Node.js 24 or newer and PowerShell. Git is
the revision history; a checkout is a local copy. Node executes the JavaScript.
No npm dependencies, Docker daemon, OpenAI key or Google credentials are required.
Commands below start at this repository's root on the development PC, not R730.

1. Run `node --version`; expect 24 or newer. Stop if the runtime is missing/older
   and arrange development tools without changing the installed app.
2. Read [the architecture](architecture.md), then open `.env.example`. An environment
   variable is a named setting supplied to a process. The example contains
   placeholders, not working credentials or the current server configuration.
3. Run `node --test`. Expect the test summary to pass. Tests use synthetic inputs
   and mock provider adapters. On Windows the POSIX shutdown test is skipped;
   Linux image CI supplies that check. Do not run setup/start to make tests pass.
4. Open `test/core.test.mjs` to see invented dates, shift validation and existing-event
   decisions. Find a conflict case: an existing shift with a different time is held,
   not overwritten. This is a learning exercise, not an actual calendar test.

Report failing test names, Node version and commit to the app maintainer. No
production change needs undoing. The optional `DEMO_MODE=1` is an isolated UI mode
that prevents real parsing/calendar writes; this tutorial does not launch it.

## Connected setup is a separate operation

For a new authorized installation, first agree the destination/calendar access and
trusted network. `npm run setup` creates a new local `.env` with random password
and signing secret; it refuses to overwrite an existing file. Never rerun it or
the historical installer against the established deployment as an upgrade.
The operator privately provides a restricted OpenAI key and a Google service-account
key with event-edit access only to Reachel Test. Do not paste keys or screenshots
into chat/GitHub. The [reference](reference.md), [security guide](../SECURITY.md)
and [deployment gates](deployment.md) are prerequisites. Continue through the
[existing first parsing setup](../README.md#2-first-parsing-test-on-a-computer-with-nodejs-24)
and [Google access setup](../README.md#4-give-this-app-access-to-reachel-test) only
under that new-install plan. Direct Node startup listens on all IPv4 interfaces;
`PUBLIC_URL=localhost` is not network isolation. The [reference](reference.md)
explains the distinct Compose host binding. This pilot authorizes
no connected setup or calendar acceptance test.
