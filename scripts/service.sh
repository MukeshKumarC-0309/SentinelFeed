#!/bin/bash
#
# Manage the SENTINEL FEED background service.
#
#   install        install as a LaunchAgent and start it
#
#   scripts/service.sh status      where it is installed, running, next refresh
#   scripts/service.sh restart     restart it now
#   scripts/service.sh logs        follow the log
#   scripts/service.sh refresh     build a new edition immediately
#   scripts/service.sh stop        stop it, leaving it installed
#   scripts/service.sh uninstall   remove whichever one is installed
#
set -euo pipefail

LABEL="com.sentinelfeed.server"
APPDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AGENT_TEMPLATE="$APPDIR/scripts/$LABEL.plist"
AGENT_TARGET="$HOME/Library/LaunchAgents/$LABEL.plist"
LOGDIR="$HOME/Library/Logs/SentinelFeed"
GUI_DOMAIN="gui/$(id -u)"
PORT="${PORT:-4173}"
HOST="${HOST:-127.0.0.1}"
# Default the public base URL to whatever host the server will answer on.
# The tailnet name is preferred: RSS and notification links built from it work
# on your phone anywhere, where the Wi-Fi name only works at home.
tailnet_name() {
  local cli node
  for cli in /Applications/Tailscale.app/Contents/MacOS/Tailscale tailscale; do
    command -v "$cli" >/dev/null 2>&1 || [ -x "$cli" ] || continue
    node="$(command -v node || echo /opt/homebrew/bin/node)"
    TAILSCALE_BE_CLI=1 "$cli" status --json 2>/dev/null | "$node" -e '
      let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
        try{const j=JSON.parse(d);
          if(j.BackendState==="Running"&&j.Self&&j.Self.DNSName) process.stdout.write(j.Self.DNSName.replace(/\.$/,""));
        }catch{}
      });' && return 0
  done
}

if [ -z "${SITE_URL:-}" ]; then
  if [ "$HOST" = "0.0.0.0" ] || [ "$HOST" = "::" ]; then
    # Absent or signed-out Tailscale is normal; it must not abort the install.
    TS_NAME="$(tailnet_name || true)"
    if [ -n "$TS_NAME" ]; then
      SITE_URL="http://$TS_NAME:$PORT"
    else
      SITE_URL="http://$(scutil --get LocalHostName 2>/dev/null || hostname).local:$PORT"
    fi
  else
    SITE_URL="http://127.0.0.1:$PORT"
  fi
fi

say() { printf '%s\n' "$*"; }
fail() { printf 'error: %s\n' "$*" >&2; exit 1; }

find_node() {
  # Prefer a stable symlink over a version-specific path so a Node upgrade
  # does not silently break the service.
  for candidate in /opt/homebrew/bin/node /usr/local/bin/node "$(command -v node || true)"; do
    [ -n "$candidate" ] && [ -x "$candidate" ] && { printf '%s' "$candidate"; return 0; }
  done
  return 1
}

agent_loaded()  { launchctl print "$GUI_DOMAIN/$LABEL" >/dev/null 2>&1; }

# Where an installed plist thinks the app lives. Empty if not installed.
installed_appdir() {
  [ -f "$AGENT_TARGET" ] || return 0
  plutil -extract WorkingDirectory raw "$AGENT_TARGET" 2>/dev/null || true
}

# Point the `sentinel` command at this copy of the app. Renaming or moving the
# folder breaks the old symlink, and a dangling symlink is a confusing failure,
# so every install refreshes it.
link_command() {
  local target="$APPDIR/bin/sentinel"
  [ -x "$target" ] || return 0

  local existing
  existing="$(command -v sentinel 2>/dev/null || true)"
  if [ -n "$existing" ] && [ -L "$existing" ] && [ -w "$(dirname "$existing")" ]; then
    ln -sf "$target" "$existing"
    say "  command  $existing -> this folder"
    return 0
  fi
  [ -n "$existing" ] && return 0

  local dir
  for dir in /opt/homebrew/bin /usr/local/bin "$HOME/.local/bin"; do
    if [ -d "$dir" ] && [ -w "$dir" ]; then
      ln -sf "$target" "$dir/sentinel"
      say "  command  installed at $dir/sentinel"
      case ":$PATH:" in
        *":$dir:"*) ;;
        *) say "           (add $dir to your PATH to use it)" ;;
      esac
      return 0
    fi
  done
}

render() {
  local template="$1" out="$2" node nodedir
  node="$(find_node)" || fail "could not find node on this system"
  nodedir="$(dirname "$node")"
  [ -f "$APPDIR/server.js" ] || fail "server.js not found in $APPDIR"

  sed -e "s|__NODE__|$node|g" \
      -e "s|__NODEDIR__|$nodedir|g" \
      -e "s|__APPDIR__|$APPDIR|g" \
      -e "s|__LOGDIR__|$LOGDIR|g" \
      -e "s|__PORT__|$PORT|g" \
      -e "s|__HOST__|$HOST|g" \
      -e "s|__USER__|$(id -un)|g" \
      -e "s|__GROUP__|$(id -gn)|g" \
      -e "s|__HOME__|$HOME|g" \
      -e "s|__SITEURL__|$SITE_URL|g" \
      "$template" > "$out"

  plutil -lint "$out" >/dev/null || fail "generated plist is invalid"
  printf '%s' "$node"
}

wait_ready() {
  say ""
  say "Waiting for the server (the first edition takes about ten seconds)..."
  for _ in $(seq 1 45); do
    if curl -fsS -o /dev/null "http://$HOST:$PORT/api/briefing" 2>/dev/null; then
      say "ready: http://$HOST:$PORT"
      return 0
    fi
    sleep 1
  done
  say "still starting - check: scripts/service.sh status"
}

cmd_install() {
  local node
  mkdir -p "$HOME/Library/LaunchAgents" "$LOGDIR"
  launchctl bootout "$GUI_DOMAIN/$LABEL" 2>/dev/null || true
  node="$(render "$AGENT_TEMPLATE" "$AGENT_TARGET")"

  launchctl bootstrap "$GUI_DOMAIN" "$AGENT_TARGET"
  launchctl enable "$GUI_DOMAIN/$LABEL"

  link_command
  say "installed LaunchAgent $LABEL (starts at login)"
  say "  node     $node"
  say "  app      $APPDIR"
  say "  logs     $LOGDIR/sentinel-feed.log"
  say "  url      http://$HOST:$PORT"
  wait_ready
}

cmd_uninstall() {
  local removed=0

  if agent_loaded || [ -f "$AGENT_TARGET" ]; then
    launchctl bootout "$GUI_DOMAIN/$LABEL" 2>/dev/null || true
    rm -f "$AGENT_TARGET"
    say "removed the LaunchAgent"
    removed=1
  fi

  [ "$removed" -eq 1 ] || say "nothing was installed"
  say "editions in $APPDIR/data were left alone"
}

cmd_status() {
  local info pid last
  if agent_loaded || [ -f "$AGENT_TARGET" ]; then
    say "installed as: LaunchAgent (starts at login, stops at logout)"
    info="$(launchctl print "$GUI_DOMAIN/$LABEL" 2>/dev/null || true)"
  else
    say "not installed"
    say "  install with: scripts/service.sh install"
    return 1
  fi

  if [ -n "${info:-}" ]; then
    pid="$(printf '%s' "$info" | awk '/^\tpid = /{print $3}')"
    last="$(printf '%s' "$info" | awk '/last exit code = /{print $NF}')"
    if [ -n "$pid" ]; then
      say "  process   running (pid $pid)"
    else
      say "  process   not running (last exit code: ${last:-unknown})"
    fi
  fi

  if ! curl -fsS "http://$HOST:$PORT/api/status" 2>/dev/null | node -e '
let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{
  try{
    const s=JSON.parse(d);
    const due=new Date(s.nextRefreshAt);
    const mins=Math.max(0,Math.round((due-Date.now())/60000));
    console.log(`  edition   ${s.editionId}`);
    console.log(`  editions  ${s.editionCount} on record`);
    console.log(`  sources   ${s.lastRun?`${s.lastRun.sourcesOk}/${s.lastRun.sourcesTotal} live`:"n/a"}`);
    console.log(`  next      ${due.toLocaleString()} (in ${Math.floor(mins/60)}h ${mins%60}m)`);
    if(s.lastError)console.log(`  error     ${s.lastError.message}`);
  }catch{process.exit(1);}
});'; then
    say "  (not answering on port $PORT)"
  fi

  local where
  where="$(installed_appdir)"
  if [ -n "$where" ] && [ "$where" != "$APPDIR" ]; then
    say ""
    say "  warning: the installed service points at"
    say "             $where"
    say "           but this copy of the app is at"
    say "             $APPDIR"
    if [ -f "$where/server.js" ]; then
      say "           two copies exist; reinstall from the one you want to keep"
    else
      say "           that path no longer exists — the folder was moved or renamed"
    fi
    say "           repair with: scripts/service.sh install"
  fi

  return 0
}

# Stop the service without removing it: it comes back on the next login or
# boot. `uninstall` is the one that forgets about it entirely.
cmd_stop() {
  if agent_loaded || [ -f "$AGENT_TARGET" ]; then
    launchctl bootout "$GUI_DOMAIN/$LABEL" 2>/dev/null || true
    say "stopped — still installed, starts again at next login"
  else
    pkill -f "$APPDIR/server.js" 2>/dev/null && say "stopped" || say "not running"
  fi
}

# Restart, or reload if something unloaded the job. A job that is installed but
# not loaded cannot be kickstarted - launchd no longer knows it - so restarting
# it that way fails silently, which is the one failure worth recovering from.
cmd_restart() {
  if agent_loaded; then
    launchctl kickstart -k "$GUI_DOMAIN/$LABEL"
    say "restarted"
  elif [ -f "$AGENT_TARGET" ]; then
    launchctl bootstrap "$GUI_DOMAIN" "$AGENT_TARGET"
    say "reloaded — it was installed but had been unloaded"
  else
    fail "not installed — run: scripts/service.sh install"
  fi
}

cmd_logs() {
  mkdir -p "$LOGDIR"
  touch "$LOGDIR/sentinel-feed.log" "$LOGDIR/sentinel-feed.error.log"
  tail -n 40 -f "$LOGDIR/sentinel-feed.log" "$LOGDIR/sentinel-feed.error.log"
}

cmd_refresh() {
  local token="${SENTINEL_TOKEN:-}" code
  if [ -z "$token" ] && [ -f "$APPDIR/data/secret.json" ]; then
    token="$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).token||"")' "$APPDIR/data/secret.json" 2>/dev/null || true)"
  fi
  [ -n "$token" ] || fail "no API token yet - the server creates data/secret.json when it first starts"
  code="$(curl -sS -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $token" "http://127.0.0.1:$PORT/api/refresh" 2>/dev/null || true)"
  case "$code" in
    2*)  say "refresh started - watch it with: sentinel logs" ;;
    409) say "a refresh is already running" ;;
    401) fail "the server rejected the token in data/secret.json" ;;
    *)   fail "could not reach the server on port $PORT" ;;
  esac
}

case "${1:-status}" in
  install)        cmd_install ;;
  uninstall)      cmd_uninstall ;;
  status)         cmd_status ;;
  stop)           cmd_stop ;;
  restart)        cmd_restart ;;
  logs)           cmd_logs ;;
  refresh)        cmd_refresh ;;
  *) fail "usage: service.sh [install|uninstall|status|stop|restart|logs|refresh]" ;;
esac
