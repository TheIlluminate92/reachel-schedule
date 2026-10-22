#!/bin/bash
set -euo pipefail
# Install only this new application. No existing container is stopped/replaced.
# The key remains blank; add it in Unraid's normal Docker Edit form afterward.
if [[ $(id -u) != 0 || ! -d /boot/config/plugins/dockerMan/templates-user ]]; then
  echo 'Run this from an Unraid root terminal with Docker enabled.' >&2; exit 1
fi
APP_ROOT=/mnt/cache/appdata/reachel-schedule
CONTAINER=Reachel-Schedule
PORT=${REACHEL_PORT:-3080}
HOST_IP=${REACHEL_HOST_IP:-$(ip -4 route get 1.1.1.1 | awk '{for(i=1;i<=NF;i++) if($i=="src") {print $(i+1);exit}}')}
if [[ ! "$PORT" =~ ^[0-9]+$ ]] || (( PORT < 1024 || PORT > 65535 )); then echo 'Invalid REACHEL_PORT.' >&2; exit 1; fi
if [[ ! "$HOST_IP" =~ ^(10\.[0-9]+\.[0-9]+\.[0-9]+|192\.168\.[0-9]+\.[0-9]+|172\.(1[6-9]|2[0-9]|3[01])\.[0-9]+\.[0-9]+)$ ]]; then echo 'Set REACHEL_HOST_IP to the Unraid private LAN IPv4 address.' >&2; exit 1; fi
if [[ ! -d /mnt/cache/appdata ]]; then echo 'Expected /mnt/cache/appdata is not available. Stop and choose the correct appdata pool.' >&2; exit 1; fi
if docker container inspect "$CONTAINER" >/dev/null 2>&1; then echo "$CONTAINER already exists; nothing was changed." >&2; exit 1; fi
if ss -H -ltn | awk '{print $4}' | grep -Eq ":${PORT}$"; then echo "TCP port $PORT is already in use; nothing was changed." >&2; exit 1; fi
SOURCE=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
TEMPLATE=/boot/config/plugins/dockerMan/templates-user/my-Reachel-Schedule.xml
if [[ -e "$TEMPLATE" || -e "$APP_ROOT" ]]; then echo 'An existing app directory or template was found. Nothing was overwritten.' >&2; exit 1; fi
for file in server.mjs core.mjs services.mjs public/index.html public/app.js public/style.css public/icon.svg public/manifest.webmanifest; do
  [[ -f "$SOURCE/$file" ]] || { echo "Missing package file: $file" >&2; exit 1; }
done
docker info >/dev/null
docker pull node:24-alpine
# Pull first; only start creating application files after image availability.
mkdir -p "$APP_ROOT/app/public" "$APP_ROOT/config/secrets"
chmod 750 "$APP_ROOT/config" "$APP_ROOT/config/secrets"
for file in server.mjs core.mjs services.mjs; do cp -- "$SOURCE/$file" "$APP_ROOT/app/$file"; done
for file in index.html app.js style.css icon.svg manifest.webmanifest; do cp -- "$SOURCE/public/$file" "$APP_ROOT/app/public/$file"; done
APP_PASSWORD=$(openssl rand -hex 12)
APP_SECRET=$(openssl rand -hex 32)
PUBLIC_URL="http://$HOST_IP:$PORT"
umask 077
cat > "$APP_ROOT/config/container.env" <<ENV
PUBLIC_URL=$PUBLIC_URL
PORT=3080
APP_PASSWORD=$APP_PASSWORD
APP_SECRET=$APP_SECRET
OPENAI_API_KEY=
OPENAI_MODEL=gpt-6.1-sol
GOOGLE_APPLICATION_CREDENTIALS=
SHIFT_TITLE=Reachel
MAX_PARSES_PER_DAY=20
DEMO_MODE=0
TZ=America/Chicago
ENV
cat > "$TEMPLATE" <<XML
<?xml version="1.0"?>
<Container version="2">
  <Name>$CONTAINER</Name>
  <Repository>node:24-alpine</Repository>
  <Registry>https://hub.docker.com/_/node</Registry>
  <Network>bridge</Network>
  <Privileged>false</Privileged>
  <Shell>sh</Shell>
  <WebUI>http://[IP]:[PORT:3080]/</WebUI>
  <Icon>$PUBLIC_URL/icon.svg?v=0.2</Icon>
  <Overview>Read blue-dot work nights from Reachel's HCA Timpani screenshot. Preview and edit dates before adding to Reachel Test. Add your OpenAI key in this Edit form. Google Calendar is initially unconfigured.</Overview>
  <Category>Productivity:</Category>
  <ExtraParams>--user=99:100 --workdir=/app --read-only --cap-drop=ALL --security-opt=no-new-privileges --tmpfs=/tmp:rw,noexec,nosuid,size=16m --memory=512m --cpus=1 --restart=unless-stopped</ExtraParams>
  <PostArgs>node /app/server.mjs</PostArgs>
  <Config Name="WebUI Port" Target="3080" Default="$PORT" Mode="tcp" Description="Container port 3080" Type="Port" Display="always" Required="true" Mask="false">$PORT</Config>
  <Config Name="Application files" Target="/app" Default="$APP_ROOT/app" Mode="ro" Description="Application source; read-only inside the container" Type="Path" Display="advanced" Required="true" Mask="false">$APP_ROOT/app</Config>
  <Config Name="Appdata" Target="/config" Default="$APP_ROOT/config" Mode="rw" Description="Private application configuration and future Google credential file" Type="Path" Display="always" Required="true" Mask="false">$APP_ROOT/config</Config>
  <Config Name="OpenAI API Key" Target="OPENAI_API_KEY" Default="" Description="Paste your OpenAI project key here. Restricted key: Responses WRITE. Leave blank until ready." Type="Variable" Display="always" Required="false" Mask="true"></Config>
  <Config Name="App Password" Target="APP_PASSWORD" Default="" Description="Password for the upload page; at least 12 characters. Reveal or replace the generated value here." Type="Variable" Display="always" Required="true" Mask="true">$APP_PASSWORD</Config>
  <Config Name="Public URL" Target="PUBLIC_URL" Default="$PUBLIC_URL" Description="Exact address used to open the app; use HTTPS when exposing through NPM." Type="Variable" Display="always" Required="true" Mask="false">$PUBLIC_URL</Config>
  <Config Name="OpenAI Model" Target="OPENAI_MODEL" Default="gpt-6.1-sol" Description="Vision and Structured Outputs capable model" Type="Variable" Display="always" Required="true" Mask="false">gpt-6.1-sol</Config>
  <Config Name="Google Credential File" Target="GOOGLE_APPLICATION_CREDENTIALS" Default="" Description="Leave blank for the image test. Later set /config/secrets/google.json after sharing Reachel Test to the service account." Type="Variable" Display="always" Required="false" Mask="false"></Config>
  <Config Name="Event Title" Target="SHIFT_TITLE" Default="Reachel" Description="Title for new shifts" Type="Variable" Display="always" Required="true" Mask="false">Reachel</Config>
  <Config Name="Daily Screenshot Limit" Target="MAX_PARSES_PER_DAY" Default="20" Description="In-memory limit per UTC day; restarts reset it" Type="Variable" Display="advanced" Required="true" Mask="false">20</Config>
  <Config Name="Session Secret" Target="APP_SECRET" Default="" Description="Preserve this random value. Changing it signs out all phones." Type="Variable" Display="advanced" Required="true" Mask="true">$APP_SECRET</Config>
  <Config Name="Demo Mode" Target="DEMO_MODE" Default="0" Description="1 shows synthetic example dates and disables all live providers" Type="Variable" Display="advanced" Required="true" Mask="false">0</Config>
  <Config Name="Internal Port" Target="PORT" Default="3080" Type="Variable" Display="advanced-hide" Required="true" Mask="false">3080</Config>
  <Config Name="Timezone" Target="TZ" Default="America/Chicago" Type="Variable" Display="advanced" Required="true" Mask="false">America/Chicago</Config>
</Container>
XML
chmod 600 "$TEMPLATE" "$APP_ROOT/config/container.env"
chown -R 99:100 "$APP_ROOT"
docker run -d --name "$CONTAINER" --net bridge --user 99:100 --workdir /app \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m --memory 512m --cpus 1 --restart unless-stopped \
  --label net.unraid.docker.managed=dockerman \
  --label "net.unraid.docker.webui=http://[IP]:[PORT:3080]/" \
  --label "net.unraid.docker.icon=$PUBLIC_URL/icon.svg" \
  --publish "$HOST_IP:$PORT:3080/tcp" \
  --volume "$APP_ROOT/app:/app:ro" --volume "$APP_ROOT/config:/config:rw" \
  --env-file "$APP_ROOT/config/container.env" node:24-alpine node /app/server.mjs >/dev/null
for attempt in {1..30}; do
  if curl --noproxy '*' -fsS --max-time 2 "$PUBLIC_URL/healthz" >/dev/null; then
    # Docker's environment is now authoritative, and the template preserves its
    # editable values. Remove the bootstrap env so it cannot become a stale copy.
    rm -- "$APP_ROOT/config/container.env"
    echo "Installed $CONTAINER: $PUBLIC_URL"
    echo 'Unraid Docker > Reachel-Schedule > Edit: paste OpenAI API Key, then Apply.'
    echo 'App Password is generated in the same Edit form; reveal or replace it.'
    echo 'Google Calendar remains unconfigured. No screenshot or calendar operation was performed.'
    exit 0
  fi
  sleep 1
done
echo 'The container was created but did not become healthy. Inspect its Unraid log; no other container was changed.' >&2
exit 1
