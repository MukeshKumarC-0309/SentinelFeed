<#
  SENTINEL FEED - background service for Windows.

    service.ps1 install     start at sign-in, keep the server running, add sentinel to PATH
    service.ps1 uninstall   remove the task, stop the server, tidy PATH
    service.ps1 status      installed? running? current edition, next refresh
    service.ps1 stop        stop it, leaving it installed
    service.ps1 restart     restart it, starting it if it was stopped
    service.ps1 start       start it now without installing anything
    service.ps1 logs        follow the log
    service.ps1 refresh     build a fresh edition now
    service.ps1 run         the supervisor the scheduled task runs

  Options (install remembers them, so a later reinstall keeps them):
    -BindHost 0.0.0.0       reachable beyond this PC, e.g. from a phone over Tailscale
    -Port 4173
    -SiteUrl http://...     base URL used in RSS and notification links

  Written for Windows PowerShell 5.1, which every Windows 10 and 11 PC has;
  it also runs under PowerShell 7.
#>
[CmdletBinding()]
param(
  [Parameter(Position = 0)][string]$Command = 'status',
  [string]$BindHost = '',
  [int]$Port = 0,
  [string]$SiteUrl = ''
)

$ErrorActionPreference = 'Stop'

$TaskName   = 'SentinelFeed'
$AppDir     = Split-Path -Parent $PSScriptRoot
$ServerJs   = Join-Path $AppDir 'server.js'
$BinDir     = Join-Path $AppDir 'bin'
$StateDir   = Join-Path $env:LOCALAPPDATA 'SentinelFeed'
$LogDir     = Join-Path $StateDir 'logs'
$ConfigFile = Join-Path $StateDir 'service.json'
$OutLog     = Join-Path $LogDir 'sentinel-feed.log'
$ErrLog     = Join-Path $LogDir 'sentinel-feed.error.log'
# Used only when Windows refuses to register the scheduled task.
$StartupLnk = Join-Path ([Environment]::GetFolderPath('Startup')) 'SentinelFeed.lnk'

function Say([string]$Message) { Write-Host $Message }
function Fail([string]$Message) { Write-Host "error: $Message" -ForegroundColor Red; exit 1 }

# ---- settings ----------------------------------------------------------------

function Read-Config {
  if (-not (Test-Path $ConfigFile)) { return $null }
  try { return ([IO.File]::ReadAllText($ConfigFile) | ConvertFrom-Json) } catch { return $null }
}

function Write-Config($Settings) {
  New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
  # WriteAllText writes UTF-8 without a BOM, which every reader here handles.
  [IO.File]::WriteAllText($ConfigFile, ($Settings | ConvertTo-Json))
}

$Config = Read-Config

# Command line first, then what install remembered, then the environment, then defaults.
if (-not $BindHost) {
  if ($Config -and $Config.host) { $BindHost = $Config.host }
  elseif ($env:HOST) { $BindHost = $env:HOST }
  else { $BindHost = '127.0.0.1' }
}
if (-not $Port) {
  if ($Config -and $Config.port) { $Port = [int]$Config.port }
  elseif ($env:PORT) { $Port = [int]$env:PORT }
  else { $Port = 4173 }
}
$BaseUrl = "http://127.0.0.1:$Port"

# ---- helpers -----------------------------------------------------------------

function Find-Node {
  $onPath = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($onPath) { return $onPath.Source }
  if ($Config -and $Config.node -and (Test-Path $Config.node)) { return $Config.node }
  $standard = Join-Path $env:ProgramFiles 'nodejs\node.exe'
  if (Test-Path $standard) { return $standard }
  return $null
}

function Test-Responding {
  try {
    $null = Invoke-RestMethod -Uri "$BaseUrl/api/status" -TimeoutSec 3 -UseBasicParsing
    return $true
  } catch { return $false }
}

function Wait-Ready([int]$Seconds = 60) {
  for ($i = 0; $i -lt $Seconds; $i++) {
    if (Test-Responding) { return $true }
    Start-Sleep -Seconds 1
  }
  return $false
}

function Get-Task { Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue }

function Get-InstallMode {
  if (Get-Task) { return 'task' }
  if (Test-Path $StartupLnk) { return 'startup' }
  return $null
}

function Get-ServerProcesses {
  @(Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine.IndexOf($ServerJs, [StringComparison]::OrdinalIgnoreCase) -ge 0 })
}

function Get-SupervisorProcesses {
  @(Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe' OR Name = 'pwsh.exe'" -ErrorAction SilentlyContinue |
    Where-Object {
      $_.ProcessId -ne $PID -and $_.CommandLine -and
      $_.CommandLine.IndexOf($PSCommandPath, [StringComparison]::OrdinalIgnoreCase) -ge 0 -and
      $_.CommandLine -match '\srun(\s|$)'
    })
}

function Stop-Everything {
  $task = Get-Task
  if ($task -and $task.State -eq 'Running') { Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue }
  # The supervisor goes first, or it would simply start the server again.
  foreach ($p in (Get-SupervisorProcesses)) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
  foreach ($p in (Get-ServerProcesses)) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
}

# A headless console host runs the supervisor with no window at all. Plain
# -WindowStyle Hidden is not enough where Windows Terminal is the default
# terminal: it opens a visible window regardless. Needs Windows 10 1903+.
$Conhost    = Join-Path $env:SystemRoot 'System32\conhost.exe'
$PowerShell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$Headless   = ([Environment]::OSVersion.Version.Build -ge 18362) -and (Test-Path $Conhost)
$RunArgs    = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$PSCommandPath`" run"

function Get-TailnetName {
  $ErrorActionPreference = 'Continue'
  $cli = Get-Command tailscale.exe -ErrorAction SilentlyContinue
  if ($cli) { $cli = $cli.Source }
  else {
    $cli = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
    if (-not (Test-Path $cli)) { return $null }
  }
  try {
    $status = (& $cli status --json 2>$null | Out-String) | ConvertFrom-Json
    if ($status.BackendState -ne 'Running' -or -not $status.Self.DNSName) { return $null }
    return $status.Self.DNSName.TrimEnd('.')
  } catch { return $null }
}

# Edit the user PATH in the registry directly, preserving REG_EXPAND_SZ.
# [Environment]::SetEnvironmentVariable would rewrite it as REG_SZ, which
# silently breaks entries like %USERPROFILE%\AppData\Local\Microsoft\WindowsApps.
function Update-UserPath([string]$Add, [string]$Remove) {
  $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
  try {
    $current = [string]$key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
    $normalise = { param($value) $value.TrimEnd('\').ToLowerInvariant() }
    $kept = New-Object System.Collections.Generic.List[string]
    foreach ($entry in ($current -split ';')) {
      if (-not $entry) { continue }
      $n = & $normalise $entry
      if ($Remove -and $n -eq (& $normalise $Remove)) { continue }
      if ($Add -and $n -eq (& $normalise $Add)) { continue }
      $kept.Add($entry)
    }
    if ($Add) { $kept.Add($Add) }
    $updated = $kept -join ';'
    if ($updated -eq $current) { return $false }
    $key.SetValue('Path', $updated, [Microsoft.Win32.RegistryValueKind]::ExpandString)
  } finally { $key.Close() }

  # Tell Explorer the environment changed, so new terminals see it without a sign-out.
  try {
    if (-not ('SentinelFeed.NativeMethods' -as [type])) {
      Add-Type -Namespace SentinelFeed -Name NativeMethods -MemberDefinition @'
[DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Auto)]
public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);
'@
    }
    $ignored = [UIntPtr]::Zero
    [void][SentinelFeed.NativeMethods]::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$ignored)
  } catch { }
  return $true
}

# ---- commands ----------------------------------------------------------------

function Invoke-Install {
  $node = Find-Node
  if (-not $node) { Fail 'Node.js was not found. Install it with: winget install OpenJS.NodeJS.LTS' }
  if (-not (Test-Path $ServerJs)) { Fail "server.js was not found in $AppDir" }

  if (-not $SiteUrl) {
    if ($BindHost -eq '0.0.0.0' -or $BindHost -eq '::') {
      # The tailnet name makes feed links work from a phone anywhere.
      $name = Get-TailnetName
      if ($name) { $SiteUrl = "http://${name}:$Port" }
      else { $SiteUrl = "http://$($env:COMPUTERNAME.ToLowerInvariant()):$Port" }
    } else {
      $SiteUrl = "http://127.0.0.1:$Port"
    }
  }

  Stop-Everything

  # Remember this copy's location, so a moved or renamed folder can be spotted
  # and its old PATH entry cleaned up on the next install.
  $previousBin = $null
  if ($Config -and $Config.binDir) { $previousBin = $Config.binDir }
  Write-Config ([ordered]@{ appDir = $AppDir; binDir = $BinDir; node = $node; host = $BindHost; port = $Port; siteUrl = $SiteUrl })

  if ($Headless) {
    $action = New-ScheduledTaskAction -Execute $Conhost -Argument "--headless `"$PowerShell`" $RunArgs" -WorkingDirectory $AppDir
  } else {
    $action = New-ScheduledTaskAction -Execute $PowerShell -Argument $RunArgs -WorkingDirectory $AppDir
  }
  $user      = "$env:USERDOMAIN\$env:USERNAME"
  $trigger   = New-ScheduledTaskTrigger -AtLogOn -User $user
  $settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
                 -MultipleInstances IgnoreNew -ExecutionTimeLimit ([TimeSpan]::Zero) `
                 -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
  $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
  try {
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal `
      -Description 'Keeps the SENTINEL FEED server running while you are signed in.' -Force | Out-Null
    if (Test-Path $StartupLnk) { Remove-Item $StartupLnk -Force }
    Start-ScheduledTask -TaskName $TaskName
    $how = 'scheduled task SentinelFeed (starts at sign-in, restarts if it stops)'
  } catch {
    # Some machines only let administrators create sign-in tasks. A shortcut in
    # the Startup folder does the same job and never needs elevation; the
    # supervisor it starts still restarts the server if it stops.
    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut($StartupLnk)
    if ($Headless) {
      $link.TargetPath = $Conhost
      $link.Arguments = "--headless `"$PowerShell`" $RunArgs"
    } else {
      $link.TargetPath = $PowerShell
      $link.Arguments = $RunArgs
    }
    $link.WorkingDirectory = $AppDir
    $link.WindowStyle = 7
    $link.Description = 'Keeps the SENTINEL FEED server running while you are signed in.'
    $link.Save()
    Invoke-Start | Out-Null
    $how = 'Startup folder shortcut (starts at sign-in, restarts if it stops)'
  }

  $pathChanged = Update-UserPath -Add $BinDir -Remove $previousBin

  Say "installed as $how"
  Say "  node     $node"
  Say "  app      $AppDir"
  Say "  logs     $OutLog"
  Say "  url      http://${BindHost}:$Port"
  if ($pathChanged) { Say '  command  sentinel added to your PATH - open a new terminal to use it' }
  Say ''
  Say 'Waiting for the server (the first edition takes about 30 seconds)...'
  if (Wait-Ready 90) { Say "ready: $BaseUrl" } else { Say 'still starting - check: sentinel status' }

  if ($BindHost -ne '127.0.0.1' -and $BindHost -ne 'localhost') {
    Say ''
    Say 'To reach it from your phone over Tailscale, allow it through Windows Firewall'
    Say 'on the Tailscale adapter only. Run this once in PowerShell opened as administrator:'
    Say ''
    Say "  New-NetFirewallRule -DisplayName 'SENTINEL FEED (Tailscale)' -Direction Inbound -Action Allow -Protocol TCP -LocalPort $Port -InterfaceAlias Tailscale"
    Say ''
    Say 'Scoping it to Tailscale keeps the site closed to everyone else on shared Wi-Fi.'
  }
}

function Invoke-Uninstall {
  Stop-Everything
  $removed = $false
  if (Get-Task) {
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Say 'removed the scheduled task'
    $removed = $true
  }
  if (Test-Path $StartupLnk) {
    Remove-Item $StartupLnk -Force
    Say 'removed the Startup folder shortcut'
    $removed = $true
  }
  if (-not $removed) { Say 'nothing was installed' }
  $bin = $BinDir
  if ($Config -and $Config.binDir) { $bin = $Config.binDir }
  if (Update-UserPath -Add $null -Remove $bin) { Say 'removed sentinel from your PATH' }
  if (Test-Path $ConfigFile) { Remove-Item $ConfigFile -Force }
  Say "editions in $(Join-Path $AppDir 'data') were left alone"
}

function Invoke-Status {
  $mode = Get-InstallMode
  if (-not $mode) {
    Say 'not installed'
    Say '  install with: sentinel install'
    if (Test-Responding) { Say "  a server is answering on $BaseUrl, started by hand" }
    exit 1
  }

  if ($mode -eq 'task') { Say 'installed as: scheduled task (starts at sign-in, restarts if it stops)' }
  else { Say 'installed as: Startup folder shortcut (starts at sign-in, restarts if it stops)' }
  $server = Get-ServerProcesses
  if ($server.Count -gt 0) {
    Say "  process   running (pid $($server[0].ProcessId))"
  } elseif ($mode -eq 'task') {
    $task = Get-Task
    $info = Get-ScheduledTaskInfo -TaskName $TaskName
    Say ("  process   not running (task {0}, last result 0x{1:X})" -f $task.State, $info.LastTaskResult)
  } else {
    Say '  process   not running'
  }

  try {
    $s = Invoke-RestMethod -Uri "$BaseUrl/api/status" -TimeoutSec 4 -UseBasicParsing
    Say "  edition   $($s.editionId)"
    Say "  editions  $($s.editionCount) on record"
    if ($s.lastRun) { Say "  sources   $($s.lastRun.sourcesOk)/$($s.lastRun.sourcesTotal) live" }
    # PowerShell 7 already turns ISO timestamps into dates; 5.1 leaves strings.
    $due = $s.nextRefreshAt
    if ($due -isnot [DateTime]) {
      $due = [DateTime]::Parse($due, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind)
    }
    $due = $due.ToLocalTime()
    $mins = [Math]::Max(0, [int]($due - (Get-Date)).TotalMinutes)
    Say ("  next      {0:g} (in {1}h {2}m)" -f $due, [Math]::Floor($mins / 60), ($mins % 60))
  } catch {
    Say "  (not answering on port $Port)"
  }

  if ($Config -and $Config.appDir -and ($Config.appDir -ne $AppDir)) {
    Say ''
    Say '  warning: the installed task runs the copy at'
    Say "             $($Config.appDir)"
    Say '           but this copy of the app is at'
    Say "             $AppDir"
    if (Test-Path (Join-Path $Config.appDir 'server.js')) {
      Say '           two copies exist; reinstall from the one you want to keep'
    } else {
      Say '           that folder no longer exists - it was moved or renamed'
    }
    Say '           repair with: sentinel install'
  }
}

function Invoke-Stop {
  $mode = Get-InstallMode
  if (-not $mode -and (Get-ServerProcesses).Count -eq 0) { Say 'not running'; return }
  Stop-Everything
  if ($mode) { Say 'stopped - still installed, starts again at next sign-in' } else { Say 'stopped' }
}

function Invoke-Restart {
  $mode = Get-InstallMode
  if (-not $mode) { Fail 'not installed - run: sentinel install' }
  Stop-Everything
  if ($mode -eq 'task') {
    if ((Get-Task).State -eq 'Disabled') { Enable-ScheduledTask -TaskName $TaskName | Out-Null }
    Start-ScheduledTask -TaskName $TaskName
  } else {
    Invoke-Start | Out-Null
  }
  if (Wait-Ready 60) { Say 'restarted' } else { Say 'started, but not answering yet - check: sentinel logs' }
}

function Invoke-Start {
  if (Test-Responding) { Say "already running on $BaseUrl"; return }
  if ((Get-SupervisorProcesses).Count -gt 0) { Say 'already starting'; return }
  if ($Headless) {
    Start-Process -FilePath $Conhost -ArgumentList "--headless `"$PowerShell`" $RunArgs" -WindowStyle Hidden
  } else {
    Start-Process -FilePath $PowerShell -ArgumentList $RunArgs -WindowStyle Hidden
  }
  Say 'starting in the background'
}

function Invoke-Logs {
  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
  foreach ($f in @($OutLog, $ErrLog)) { if (-not (Test-Path $f)) { New-Item -ItemType File -Path $f | Out-Null } }
  if ((Get-Item $ErrLog).Length -gt 0) {
    Say '--- recent errors ---'
    Get-Content $ErrLog -Tail 15
    Say '--- log (Ctrl+C to stop) ---'
  }
  Get-Content $OutLog -Tail 40 -Wait
}

function Invoke-Refresh {
  if (-not (Test-Responding)) { Fail "the server is not answering on $BaseUrl - start it with: sentinel" }
  $secret = Join-Path (Join-Path $AppDir 'data') 'secret.json'
  if (-not $env:SENTINEL_TOKEN -and -not (Test-Path $secret)) { Fail 'no API token yet - the server creates data\secret.json when it first starts' }
  $token = $env:SENTINEL_TOKEN
  if (-not $token) { $token = ([IO.File]::ReadAllText($secret) | ConvertFrom-Json).token }
  try {
    Invoke-RestMethod -Method Post -Uri "$BaseUrl/api/refresh" -Headers @{ Authorization = "Bearer $token" } -UseBasicParsing | Out-Null
    Say 'refresh started - watch it with: sentinel logs'
  } catch {
    $code = 0
    if ($_.Exception.Response) { $code = [int]$_.Exception.Response.StatusCode }
    if ($code -eq 409) { Say 'a refresh is already running' }
    elseif ($code -eq 401) { Fail 'the server rejected the token in data\secret.json' }
    else { Fail "the refresh request failed: $($_.Exception.Message)" }
  }
}

# The task runs this. It is the equivalent of launchd's KeepAlive: start the
# server, wait for it to exit, start it again - but never faster than every
# ten seconds, so a persistent failure cannot spin.
function Invoke-Run {
  $ErrorActionPreference = 'Continue'
  $node = Find-Node
  if (-not $node) { exit 1 }
  New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

  $env:HOST     = $BindHost
  $env:PORT     = [string]$Port
  $env:NODE_ENV = 'production'
  if ($Config -and $Config.siteUrl) { $env:SITE_URL = $Config.siteUrl }

  while ($true) {
    # Another copy - one started by hand, say - already holds the port.
    # Starting a second would only fail, so wait and take over if it stops.
    if (Test-Responding) { Start-Sleep -Seconds 30; continue }

    # Keep the previous run's output: after a crash it is what explains it.
    foreach ($pair in @(@($OutLog, 'sentinel-feed.previous.log'), @($ErrLog, 'sentinel-feed.previous.error.log'))) {
      if ((Test-Path $pair[0]) -and (Get-Item $pair[0]).Length -gt 0) {
        Copy-Item $pair[0] (Join-Path $LogDir $pair[1]) -Force
      }
    }

    $started = Get-Date
    $proc = Start-Process -FilePath $node -ArgumentList "`"$ServerJs`"" -WorkingDirectory $AppDir `
              -NoNewWindow -PassThru -RedirectStandardOutput $OutLog -RedirectStandardError $ErrLog
    $null = $proc.Handle   # hold the handle so the exit code survives the exit
    $proc.WaitForExit()

    $elapsed = ((Get-Date) - $started).TotalSeconds
    if ($elapsed -lt 10) { Start-Sleep -Seconds ([int](10 - $elapsed) + 1) }
  }
}

switch ($Command.ToLowerInvariant()) {
  'install'   { Invoke-Install }
  'uninstall' { Invoke-Uninstall }
  'status'    { Invoke-Status }
  'stop'      { Invoke-Stop }
  'restart'   { Invoke-Restart }
  'start'     { Invoke-Start }
  'logs'      { Invoke-Logs }
  'refresh'   { Invoke-Refresh }
  'run'       { Invoke-Run }
  default     { Fail "unknown command: $Command (try: install, uninstall, status, stop, restart, start, logs, refresh)" }
}
