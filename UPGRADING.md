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

Do not remove their directories or the shared question.png fallback. The first
private image pull and native update succeeded on Waz-Server. The app's PNG
responded with HTTP 200 while the Docker page still showed a question mark.
That UI state is separate from whether the new image is running.

## Routine updates

Push intended changes to main, wait for Publish app image to succeed, then use
Unraid Check for Updates / Update for Reachel-Schedule. Record the working image
digest or sha tag before updating. Source and all six public files arrive
inside the image. Do not copy them into the old host app directory.

Reload the page. Re-add a phone shortcut if its icon remains cached. Verify
artwork, layout, login, review and conflict warnings. No dummy calendar events
or deletions belong to an image update. Actual imports require explicit review.

The native updater can run quietly from a terminal; its progress is normally
published to the Docker page. Avoid starting a second update while the first
is still running. Afterward verify the image and health, rather than judging
completion by whether the terminal printed progress.

From v0.3.2, the app logs the received stop signal and exits after its HTTP
server closes. Idle connections close immediately; active requests may take
longer. Update only when no screenshot read or intended calendar import is in
progress. The image build measures an idle Docker stop and rejects abnormal
exits or stop times of four seconds or more. This measures the app container,
not Unraid's complete pull/update/UI sequence. Docker's health indication is
also scheduled separately from when the app starts listening.

## Docker icon still shows a question mark

After the new image is healthy, the following Unraid-terminal command verifies
the live PNG, backs up only this container's two icon caches and Docker page
metadata, invokes Unraid's own icon downloader, and changes only this
container's icon entry in that metadata. It does not recreate the container,
copy app source, or touch credentials. Refresh the Docker page afterward.
This repair still needs live verification on the server.

```bash
php <<'PHP'
<?php
$docroot = '/usr/local/emhttp';
require_once "$docroot/plugins/dynamix.docker.manager/include/DockerClient.php";
$name = 'Reachel-Schedule';
$image = 'ghcr.io/theilluminate92/reachel-schedule:latest';
$url = 'http://192.168.2.2:3080/docker-icon.png';
$templates = new DockerTemplates();
if ($templates->getTemplateValue($image, 'Icon', 'all', $name) !== $url) {
    fwrite(STDERR, "Set this container's template Icon URL to $url first.\n");
    exit(1);
}
$ch = curl_init($url);
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_FAILONERROR => true, CURLOPT_TIMEOUT => 10]);
$bytes = curl_exec($ch);
curl_close($ch);
if (!is_string($bytes) || strlen($bytes) < 24 || substr($bytes, 0, 8) !== "\x89PNG\r\n\x1a\n") {
    fwrite(STDERR, "The app did not return a valid PNG. No caches changed.\n");
    exit(1);
}
$size = unpack('Nwidth/Nheight', substr($bytes, 16, 8));
if ($size['width'] !== 512 || $size['height'] !== 512) exit(1);
$stamp = date('Ymd-His');
$state = $dockerManPaths['webui-info'];
if (!is_file($state) || !copy($state, "$state.reachel-backup-$stamp")) exit(1);
chmod("$state.reachel-backup-$stamp", 0600);
foreach (['images', 'images-ram'] as $key) {
    $file = $dockerManPaths[$key]."/$name-icon.png";
    if (is_link($file)) exit(1);
    if (is_file($file)) {
        if (!copy($file, "$file.backup-$stamp") || !unlink($file)) exit(1);
    }
}
$icon = $templates->getIcon($image, $name, $url);
if (!$icon || !is_file($docroot.$icon) || hash_file('sha256', $docroot.$icon) !== hash('sha256', $bytes)) {
    fwrite(STDERR, "Unraid could not cache the expected PNG. Backups retained.\n");
    exit(1);
}
$info = DockerUtil::loadJSON($state);
if (!isset($info[$name])) exit(1);
$info[$name]['icon'] = $icon;
DockerUtil::saveJSON($state, $info);
echo "Reachel icon refreshed. Reload the Docker page.\n";
PHP
```

## Rollback

Set Repository to the previous working
`ghcr.io/theilluminate92/reachel-schedule:sha-<full commit>` tag or digest and
Apply. Preserve /config and environment values. Return to latest to resume updates.

To undo the initial migration, restore the saved template with node:24-alpine
and its read-only /app mapping to the preserved original app directory, then
Apply. Keep configuration and credentials in place. Calendar events are unchanged.
