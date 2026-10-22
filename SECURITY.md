# Security and privacy

This is a personal, single-household application with one shared password.
It is not a multi-user or multi-tenant service.

## Intended network access

- Keep it on a trusted private LAN. No public DNS, port forward, proxy, or
  tunnel is needed for the home-Wi-Fi workflow.
- A private IP does not limit access to one person. Wired devices, other VLANs,
  and VPN users may reach it if your firewall allows them.
- Keep APP_PASSWORD set (minimum 12 characters). The server refuses to start
  without a password and a signing secret of at least 32 characters.
- LAN HTTP does not encrypt login or session traffic. Use a trusted network;
  configure HTTPS if stronger protection on that network is required.
- PUBLIC_URL must exactly match the origin used on the phone. It is an origin
  check, not a firewall or network-binding control.

## Sessions

Sessions last up to 90 days. Cookies are signed, HttpOnly and SameSite=Lax,
and Secure when PUBLIC_URL uses HTTPS. POST requests require the configured
origin; authenticated changes also require a session-specific CSRF token.
Login attempts are limited to ten failures per direct peer per 15 minutes.
These limits are in memory and reset on restart.

Changing APP_SECRET and restarting invalidates all existing sessions.
Changing APP_PASSWORD alone does not invalidate existing sessions.
Server administrators with Docker/root access can read stored credentials.
Masking a field in Docker Edit does not encrypt it.

## Provider credentials

- Never commit .env, config/, secrets/, container.env, service-account JSON,
  private keys, actual screenshots, or exported Docker templates containing keys.
- Keep the OpenAI key server-side. A Restricted key needs Responses Write/Create.
- Share only Reachel Test with the Google service account. Grant event editing,
  not calendar sharing administration. No domain-wide delegation is needed.
- On the normal Unraid installation the Google key should be owned by 99:100,
  mode 600, inside config/secrets/ (directory mode 750).
- The destination calendar ID is in core.mjs. It is an identifier, not a secret
  or an access credential. Sharing permissions still control calendar access.
- Keep this repository private if you do not want personal calendar identifiers,
  household names, or operational details published.
- Revoke a leaked OpenAI key or Google service-account key at the provider,
  replace it locally, and restart. Rotate APP_SECRET for a leaked session secret.

## Data flow and limits

The selected screenshot is sent to OpenAI for parsing. This app does not write
image bytes to disk. store:false is requested; that is not a zero-retention
guarantee. OpenAI account data controls and provider retention still apply.

Dates and event details go to Google only after explicit confirmation.
The app creates missing shifts; it does not invite attendees, delete events,
or automatically reconcile removed dates. Calendar reminder defaults can apply.
Deterministic IDs and existing-event checks reduce duplicates. Review any
Unconfirmed result directly in Calendar before retrying.

The daily parse limit is an in-memory guard, not a billing hard cap. Restarting
resets it. AI may misread dots or grid positions; review remains mandatory.

## Reporting problems

Report a reproducible description without API keys, JSON credentials, screenshots
of private schedules, passwords, or environment dumps. Do not post secrets in
GitHub issues. There is no separate monitored security contact for this project.
