# Updating an existing Unraid installation

Do not run install-unraid.sh again: it intentionally refuses to overwrite an
existing installation. Do not replace the config directory or saved template
with files from GitHub. Your keys and generated login settings live there.

## v0.1 / v0.2 to v0.3: appearance-only update

This release changes public/index.html, public/style.css, public/app.js display
punctuation, public/icon.svg, public/docker-icon.png, and public/manifest.webmanifest. Backend calendar
and authentication behavior is unchanged.

1. Download and extract the v0.3 source package on your computer.
2. Back up the existing app/public directory from the appdata share.
3. Copy the five files from the new public directory over the files in:
   /mnt/user/appdata/reachel-schedule/app/public/
4. Reload the page. If the old appearance remains, close and reopen the tab or
   clear that site's cached files. Existing home-screen icons may need to be
   removed and added again to pick up the new artwork/name.

These are static files served from the existing read-only application mount;
no container recreation or credential edits are needed for this theme update.
Do not change the application directory to writable inside the container.

## Unraid Docker icon

The website uses icon.svg. Unraid gets a separate 512 x 512 RGBA PNG rendered
from that same artwork: public/docker-icon.png. Copy all six public files when
updating, including this PNG. Never rename SVG bytes to .png.

For an existing installation, open Docker > Reachel-Schedule > Edit, enable
Advanced View, and set Icon URL to:

file:///mnt/cache/appdata/reachel-schedule/app/public/docker-icon.png

Apply. This local file URL is read by Unraid's server-side downloader, not by
her phone. It does not require the app to serve an image or the GitHub repo to
be public. Keep the source PNG at that path. The normal installer now sets
both its template Icon and Docker icon label to this location.

If Apply still leaves a stale or blank image, remove ONLY these two cached
icon files, then refresh the Docker page:

- /var/lib/docker/unraid/images/Reachel-Schedule-icon.png
- /usr/local/emhttp/state/plugins/dynamix.docker.manager/images/Reachel-Schedule-icon.png

Do not remove either directory or the shared question.png fallback. Unraid
repopulates this container's cached icon from its configured Icon URL. The
local file path and cache refresh still need live verification on the server.

## Rollback

Restore the six previous public files and reload. This does not alter calendar
events or credentials. Keep a separate appdata/flash backup for full recovery.

## Future backend releases

Read the release notes first. Back up the application directory, stop only
Reachel-Schedule, replace the documented source files, then start it. Preserve
config/, the Docker Edit settings, and the template. Run npm test on the source
before deployment and follow CHECKLIST.md afterward. Never run git clean or a
bulk overwrite against the directory holding credentials.

For v0.3, copy all six public files together so HTML and browser script stay
in sync. The connection-status block was removed from both. Backend files and
credentials do not need replacing. Re-add the phone shortcut if its icon
remains cached. Use the local PNG Icon URL described above for Docker.
