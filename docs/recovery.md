# Reachel backup and recovery runbook

Maintainer: Existing application worker for behavior; R730 Operations for host/runtime; Historian for guide structure.
Reviewed: 2026-11-05 (America/Chicago).
Status: documentation pilot; source and dated evidence, no runtime changes.

**Owner:** R730 Operations, with application-role compatibility review.
**Outcome:** restore one app's approved configuration/image and preserve calendar
state. Requires a separate scoped action plan; this documentation does not authorize
a restart, restore, credential change, provider test or calendar mutation.

## What a usable recovery set contains

Preserve the exact image or a verified immutable registry equivalent; current
private `/config` contents including provider credentials; original data/modes/
ownership; current approved native template, mounts/resources/security; and source/
release records. Keep these on protected private storage, never GitHub. Operations'
November 3 stopped-app backup verified all five private files plus template/inspect/
cutover records. Their presence/integrity was not re-audited November 5. Local image
and host backup presence do not prove off-host recovery or provider key validity.

Google Calendar events live at Google, not in the app image. Restoring `/config`
does not undo imports or recover deleted calendar events. Treat any calendar
recovery as a separate provider task requiring explicit review. The app does not
persist screenshot bytes; never add personal screenshots to a recovery kit merely
for this guide. Sessions are in memory and cannot be restored from the image.

## Diagnose with existing authorized access

Confirm the R730 host is Waz-Media and only one scheduler is running. In the
already authorized R730 shell, selected metadata can be read without an environment dump:

```sh
docker inspect --format='{{.Name}} image={{.Image}} running={{.State.Running}} restarts={{.RestartCount}} {{if .State.Health}}health={{.State.Health.Status}}{{end}} ports={{json .HostConfig.PortBindings}}' Reachel-Schedule
```

Expect the known image identity, current explicit host 3081 to container 3080,
and `/config` as the only data mount. Ask Operations for a safe controls/mount
projection if needed; do not post full inspect, config, keys or schedules.
If the page loads but login fails, check the exact origin and use a fresh login;
do not disable authentication/origin guards. A health response alone is insufficient.
Stop on wrong host, denied access, unexpected image/mounts, missing recovery set,
unknown credential compatibility or multiple app instances. Escalate; stop equivalent
attempts and report the concrete error on a third repeated failure.

## Ordinary app recovery under separate approval

1. Preserve **current** `/config`, permissions and template before changing anything.
   Check the backup's contents/metadata and exact recovery image. Stop if either
   is unavailable or unverified.
2. Stop and retain the failed scheduler. Confirm it is stopped before creating
   another instance; do not run two copies to investigate duplicate imports.
3. Recreate only Reachel using the exact reviewed image, existing current config
   and approved **3081 LAN** template/resources/security. No old app-source overlay,
   fresh installer, mutable latest substitute or secret regeneration.
4. Verify identity, mounts/controls, health and the expected protected-route rejection.
   Ask the owner for a fresh login and separately scoped phone/provider acceptance.
   Restart clears sessions; failed login is not reason to restore old credentials blindly.
5. Record the recovery result and remaining limits. Do not create a calendar event
   as a documentation check. For uncertain imports, inspect Calendar before retrying.

## Specifically reversing the November 3 network cutover

This differs from ordinary recovery: the retained original template restores
**wildcard host port 3080 and the former HTTPS origin**. Explain that exposure/origin
change before obtaining the scoped decision. Operations stops/retains the replacement,
reviews exact image/current configuration compatibility, restores the saved original
template/permissions and returns the retained stopped original to its normal name
before starting one instance. Use Operations' private receipt for exact identities.

Changing `PUBLIC_URL` creates no redirect and removes no proxy. Restoring the old
template cannot repair a missing proxy/certificate. A proxy still aimed at old
host 3080 loses its target after the current cutover; the old public route was not
tested end to end. Do not restore historical configuration just to restart, or
assume five-file backup credentials remain valid. **No full restore drill has been
demonstrated by the accepted evidence.**

## Untested recovery details and private receipt locator

This is a planned operator runbook, **not a proven restoration recipe**. Exact
private backup/container names and filesystem locations are intentionally omitted.
Ask **R730 Operations**, through the handbook's
[R730 handoff](https://github.com/TheIlluminate92/home-network-handbook/blob/main/docs/systems/r730/worker/handoff.md), for the
**November 3 Reachel LAN applied/cutover receipt** and **November 5 recovery-pilot handoff**. These dated titles are nonsecret locators, not public
downloads of recovery data. Confirm current protected storage access and obtain
the matching exact commands from Operations before execution.

Still unverified: complete off-host image/state availability, current credential
validity, exact restore commands against a staged recovery target, full restoration
and post-restore user/provider acceptance. Historical hashes do not fill those
gaps. If the receipt cannot be located or current state cannot be preserved, stop;
do not guess a path, recreate an empty state folder or use a fresh latest image.
