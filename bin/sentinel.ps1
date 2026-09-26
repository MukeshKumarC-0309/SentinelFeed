<#
  SENTINEL FEED - one command.

    sentinel            make sure it is running, then open it
    sentinel open       open it (assumes it is running)
    sentinel status     installed? running? next refresh
    sentinel new        build a fresh edition now
    sentinel logs       follow the log
    sentinel share      URLs and a QR code for your other devices
    sentinel stop       stop it, leaving it installed
    sentinel uninstall  remove the background task entirely
    sentinel restart    restart it
    sentinel install    start it at sign-in and keep it running

  To reach it from your phone over Tailscale:
    sentinel install -BindHost 0.0.0.0
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)][string]$Command = 'open',
  [string]$BindHost,
  [int]$Port,
  [string]$SiteUrl
)

$ErrorActionPreference = 'Stop'

$AppDir  = Split-Path -Parent $PSScriptRoot
$Service = Join-Path $AppDir 'scripts\service.ps1'
$Config  = Join-Path $env:LOCALAPPDATA 'SentinelFeed\service.json'

# Options go straight through to the service script.
$Forward = @{}
foreach ($name in 'BindHost', 'Port', 'SiteUrl') {
  if ($PSBoundParameters.ContainsKey($name)) { $Forward[$name] = $PSBoundParameters[$name] }
}

if (-not $Port) {
  $Port = 4173
  if (Test-Path $Config) {
    try { $saved = [IO.File]::ReadAllText($Config) | ConvertFrom-Json; if ($saved.port) { $Port = [int]$saved.port } } catch { }
  } elseif ($env:PORT) { $Port = [int]$env:PORT }
}
$Url = "http://127.0.0.1:$Port"

function Say([string]$Message) { Write-Host $Message }

function Invoke-Service([string]$Verb) {
  & $Service $Verb @Forward
  if ($LASTEXITCODE) { exit $LASTEXITCODE }
}

function Test-Running {
  try {
    $null = Invoke-RestMethod -Uri "$Url/api/status" -TimeoutSec 2 -UseBasicParsing
    return $true
  } catch { return $false }
}

function Confirm-Running {
  if (Test-Running) { return }

  $installed = (Get-ScheduledTask -TaskName 'SentinelFeed' -ErrorAction SilentlyContinue) -or
    (Test-Path (Join-Path ([Environment]::GetFolderPath('Startup')) 'SentinelFeed.lnk'))
  if ($installed) {
    Say 'Starting the background task...'
    & $Service restart @Forward | Out-Null
  } else {
    Say 'Not installed as a background task yet - starting it for now.'
    Say "Run 'sentinel install' to have it start automatically at sign-in."
    & $Service start @Forward | Out-Null
  }

  Say 'Waiting for the first edition (about 30 seconds on a cold start)...'
  for ($i = 0; $i -lt 90; $i++) {
    if (Test-Running) { return }
    Start-Sleep -Seconds 1
  }
  Say 'It did not come up. Try: sentinel logs'
  exit 1
}

function Show-Lead {
  try {
    $briefing = Invoke-RestMethod -Uri "$Url/api/briefing" -TimeoutSec 5 -UseBasicParsing
    $lead = @($briefing.stories)[0]
    Say ''
    if ($lead) { Say "  $($lead.title)"; Say "  $($lead.sourceName)" } else { Say '  (no stories yet)' }
    Say ''
  } catch { }
}

switch ($Command.ToLowerInvariant()) {
  'open' {
    Confirm-Running
    Say "SENTINEL FEED - $Url"
    Show-Lead
    Start-Process $Url
  }
  'new'       { Confirm-Running; Invoke-Service 'refresh' }
  'share'     { Confirm-Running; & node (Join-Path $AppDir 'scripts\share.js'); exit $LASTEXITCODE }
  'install'   { Invoke-Service 'install' }
  'uninstall' { Invoke-Service 'uninstall' }
  'status'    { Invoke-Service 'status' }
  'stop'      { Invoke-Service 'stop' }
  'restart'   { Invoke-Service 'restart' }
  'logs'      { Invoke-Service 'logs' }
  { $_ -in 'help', '-h', '--help', '/?' } {
    # Print this file's own header, so help can never drift from it.
    $text = [IO.File]::ReadAllText($PSCommandPath)
    $start = $text.IndexOf('<#') + 2
    Write-Host $text.Substring($start, $text.IndexOf('#>') - $start).TrimEnd()
  }
  default {
    Say "unknown command: $Command"
    Say 'try: sentinel help'
    exit 1
  }
}
