# Updates through GitHub and Unraid

GitHub Actions builds the complete app, runs its offline tests, checks all six
served public assets, and publishes this image on successful pushes to main:

```text
ghcr.io/theilluminate92/reachel-schedule:latest
```

Each build also publishes `sha-<full commit>` for rollback. A failed build never
moves latest. The package is private by default; repository visibility is unchanged.

## One-time migration

The original container uses node:24-alpine and mounts local files at /app.
Updating Node cannot update the app, and that mount hides the new image's files.

1. Wait for Publish app image to succeed in GitHub Actions.
2. Privately back up the existing template at
   /boot/config/plugins/dockerMan/templates-user/my-Reachel-Schedule.xml.
   Keep /mnt/cache/appdata/reachel-schedule/app as the original rollback copy.
3. Authenticate the server's Docker client to ghcr.io for the private image.
   GitHub requires a classic personal access token with read:packages. Enter
   it on the server through --password-stdin; never put it in Git, template
   fields, command history or chat. Verify authentication works with the actual
   updater; a successful interactive pull alone does not prove this.
4. In the existing template, set Repository to the image above and Registry URL
   to https://github.com/TheIlluminate92/reachel-schedule/pkgs/container/reachel-schedule.
5. Remove only the Application files mapping to container path /app. Leave the
   host directory intact. Preserve the /config mount, its host path, all
   environment values, ports, user, limits, read-only mode, security options,
   restart policy and other settings. Existing Post Arguments
   `node /app/server.mjs` remain compatible. Do not rerun install-unraid.sh.
6. Apply the existing template. This briefly interrupts this app. Check health
   at http://192.168.2.2:3080/healthz and confirm the new page is visible.
7. Verify http://192.168.2.2:3080/docker-icon.png returns a 512 x 512 PNG, then
   set Icon URL to that exact address and Apply. The image endpoint requires
   no app login; calendar endpoints retain authentication.

The previous local file Icon URL points into the old app directory, which
Docker image pulls no longer update. The new HTTP icon comes from the image.
If Unraid retains the question mark after the PNG is reachable, back up and
refresh only these container-specific cache files:

- /var/lib/docker/unraid/images/Reachel-Schedule-icon.png
- /usr/local/emhttp/state/plugins/dynamix.docker.manager/images/Reachel-Schedule-icon.png

Do not remove their directories or the shared question.png fallback. Cache
behavior and private registry pulls still require live verification on Unraid.

## Routine updates

Push intended changes to main, wait for Publish app image to succeed, then use
Unraid Check for Updates / Update for Reachel-Schedule. Record the working image
digest or sha tag before updating. Source and all six public files arrive
inside the image. Do not copy them into the old host app directory.

Reload the page. Re-add a phone shortcut if its icon remains cached. Verify
artwork, layout, login, review and conflict warnings. No dummy calendar events
or deletions belong to an image update. Actual imports require explicit review.

## Rollback

Set Repository to the previous working
`ghcr.io/theilluminate92/reachel-schedule:sha-<full commit>` tag or digest and
Apply. Preserve /config and environment values. Return to latest to resume updates.

To undo the initial migration, restore the saved template with node:24-alpine
and its read-only /app mapping to the preserved original app directory, then
Apply. Keep configuration and credentials in place. Calendar events are unchanged.
