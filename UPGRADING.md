# Updating an existing Unraid installation

Do not run install-unraid.sh again: it intentionally refuses to overwrite an
existing installation. Do not replace the config directory or saved template
with files from GitHub. Your keys and generated login settings live there.

## v0.1 to v0.2: theme-only update

This release changes public/index.html, public/style.css, public/app.js display
punctuation, public/icon.svg, and public/manifest.webmanifest. Backend calendar
and authentication behavior is unchanged.

1. Download and extract the v0.2 source package on your computer.
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

The new public/icon.svg is a square purple witch hat and gold crescent moon.
The normal installer already sets the template Icon to:

http://YOUR-UNRAID-LAN-IP:3080/icon.svg

Use the same host/port as the app. This is an icon URL, not a WebUI login URL.
The static icon is accessible without a password and contains no private data.
If needed, switch Docker Edit to Advanced View, set Icon URL to that address,
and Apply. Unraid may cache the old icon. Reload the Docker page after updating;
the new URL can use /icon.svg?v=0.2 if a cache refresh is needed.

The icon is served by the running app. A stopped container cannot serve it;
Unraid's cached image may remain available. A private GitHub raw URL is not a
suitable replacement because the Unraid browser cannot anonymously fetch it.

## Rollback

Restore the five previous public files and reload. This does not alter calendar
events or credentials. Keep a separate appdata/flash backup for full recovery.

## Future backend releases

Read the release notes first. Back up the application directory, stop only
Reachel-Schedule, replace the documented source files, then start it. Preserve
config/, the Docker Edit settings, and the template. Run npm test on the source
before deployment and follow CHECKLIST.md afterward. Never run git clean or a
bulk overwrite against the directory holding credentials.
