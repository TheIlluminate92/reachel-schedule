# Changelog

## 0.3.0

- Added a GitHub Actions build that tests and publishes the complete app to
  GitHub Container Registry for normal Unraid image updates, with commit tags
  for rollback and a documented one-time migration from the original Node image.
- Serve the genuine PNG at `/docker-icon.png` without login so Unraid can load
  the image's own Docker artwork instead of stale host-mounted files.

- Added a genuine 512px PNG for the Unraid Docker icon and changed new-install
  template/label settings to a local file URL; no dependency on the app server.

- Combined the witch theme with an anatomical heart, stethoscope, ECG line, and
  steel-colored spikes inspired by heavy-metal artwork. No flashing animation.
- Simplified the everyday upload/review/save copy and removed connection/debug
  details from the phone page. The actual calendar stays Reachel Test.
- Added versioned static-asset URLs to refresh the changed artwork and script.
- Kept date review, duplicate checks, conflict warnings, password requirements,
  screenshot privacy disclosure, and all backend behavior.


## 0.2.0

- Moonlit Halloween theme: purple panels, orange buttons, crescent moon and
  witch-hat artwork, serif headings, matching home-screen and Docker icon.
- Retained functional blue/green dot colors, review labels, and manual consent.
- Fixed corrupted display punctuation in the existing HTML and browser script.
- Documented Google JSON setup, home-Wi-Fi access, password/session behavior,
  live acceptance checks, safe theme upgrades, rollback, and credential handling.
- Expanded Git ignores to cover local configuration and common key files.
- No backend calendar or authentication changes.

## 0.1.0

- Initial screenshot parsing, editable review, fixed calendar destination,
  duplicate checks, signed login sessions, and Unraid Docker installation.
