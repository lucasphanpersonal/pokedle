# One-time setup (safe to re-run) for hosting pokemondle.io on this PC. Run from an elevated PowerShell:
#   powershell -ExecutionPolicy Bypass -File deploy\windows\install.ps1
# Creates two Windows services that start at boot without anyone signing in, plus a task that
# picks up new builds. All three run as the unprivileged LOCAL SERVICE account.
[CmdletBinding()]
param(
    [string]$CaddyVersion = '2.11.9',
    [string]$TunnelId = '1b4f45ac-3e91-40db-a003-d993f79fb54f',
    [string]$Cloudflared = 'C:\Program Files (x86)\cloudflared\cloudflared.exe'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this from an elevated PowerShell window.'
}
if (-not (Test-Path $Cloudflared)) { throw "cloudflared not found at $Cloudflared" }

$Root = 'C:\ProgramData\Pokemondle'
$deploy = Split-Path -Parent $PSScriptRoot
$localService = '*S-1-5-19'
$admins = '*S-1-5-32-544'
$system = '*S-1-5-18'
$users = '*S-1-5-11'
$account = 'NT AUTHORITY\LocalService'

function Invoke-Native {
    $exe, $rest = $args
    & $exe @rest | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "$($args -join ' ') failed with exit code $LASTEXITCODE" }
}

function Set-ServiceDefinition([string]$Name, [string]$Display, [string]$BinPath, [string]$DependsOn) {
    if (Get-Service -Name $Name -ErrorAction SilentlyContinue) {
        Invoke-Native sc.exe config $Name binPath= $BinPath start= auto obj= $account depend= $DependsOn
    }
    else {
        Invoke-Native sc.exe create $Name binPath= $BinPath start= auto obj= $account depend= $DependsOn DisplayName= $Display
    }
    Invoke-Native sc.exe failure $Name reset= 86400 actions= restart/5000/restart/5000/restart/60000
}

foreach ($name in 'PokemondleTunnel', 'PokemondleWeb') {
    if (Get-Service -Name $name -ErrorAction SilentlyContinue) { Stop-Service -Name $name -Force }
}

# Folders and permissions: LOCAL SERVICE can read everything and write only site\ and logs\.
New-Item -ItemType Directory -Force -Path "$Root\site\releases", "$Root\logs" | Out-Null
Invoke-Native icacls.exe $Root /inheritance:r /grant:r "${admins}:(OI)(CI)F" "${system}:(OI)(CI)F" "${users}:(OI)(CI)RX" "${localService}:(OI)(CI)RX"
foreach ($dir in 'site', 'logs') {
    Invoke-Native icacls.exe "$Root\$dir" /grant "${localService}:(OI)(CI)M"
}

# Caddy, pinned and checked against the project's published checksums.
$base = "https://github.com/caddyserver/caddy/releases/download/v$CaddyVersion"
$zipName = "caddy_${CaddyVersion}_windows_amd64.zip"
$tmp = Join-Path $env:TEMP "pokemondle-caddy-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $tmp | Out-Null
try {
    Invoke-WebRequest -UseBasicParsing -Uri "$base/$zipName" -OutFile "$tmp\$zipName"
    Invoke-WebRequest -UseBasicParsing -Uri "$base/caddy_${CaddyVersion}_checksums.txt" -OutFile "$tmp\checksums.txt"
    $line = Select-String -Path "$tmp\checksums.txt" -SimpleMatch $zipName | Select-Object -First 1
    if (-not $line) { throw "no checksum published for $zipName" }
    $expected = ($line.Line -split '\s+')[0].ToLowerInvariant()
    $actual = (Get-FileHash -Algorithm SHA512 -LiteralPath "$tmp\$zipName").Hash.ToLowerInvariant()
    if ($actual -ne $expected) { throw 'Caddy download failed its checksum' }
    Expand-Archive -LiteralPath "$tmp\$zipName" -DestinationPath "$tmp\caddy"
    Copy-Item -Force "$tmp\caddy\caddy.exe" "$Root\caddy.exe"
}
finally {
    Remove-Item -LiteralPath $tmp -Recurse -Force
}

# Config, updater and the tunnel secret.
Copy-Item -Force "$deploy\Caddyfile" "$Root\Caddyfile"
Copy-Item -Force "$deploy\cloudflared.yml" "$Root\cloudflared.yml"
Copy-Item -Force "$PSScriptRoot\update-site.ps1" "$Root\update-site.ps1"
$credentials = "$env:USERPROFILE\.cloudflared\$TunnelId.json"
if (Test-Path $credentials) { Copy-Item -Force $credentials "$Root\tunnel.json" }
if (-not (Test-Path "$Root\tunnel.json")) { throw "tunnel credentials not found at $credentials" }
Invoke-Native icacls.exe "$Root\tunnel.json" /inheritance:r /grant:r "${admins}:F" "${system}:F" "${localService}:R"

# The site has to exist before the web server starts serving it.
& "$Root\update-site.ps1"

# Services.
Set-ServiceDefinition 'PokemondleWeb' 'Pokemondle web server' "`"$Root\caddy.exe`" run --config `"$Root\Caddyfile`" --adapter caddyfile" '/'
Set-ServiceDefinition 'PokemondleTunnel' 'Pokemondle Cloudflare Tunnel' "`"$Cloudflared`" --config `"$Root\cloudflared.yml`" tunnel run" 'PokemondleWeb'
Start-Service -Name 'PokemondleWeb'
Start-Service -Name 'PokemondleTunnel'

# New builds, checked every 5 minutes.
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
    -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$Root\update-site.ps1`""
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 5)
$taskUser = New-ScheduledTaskPrincipal -UserId 'NT AUTHORITY\LOCAL SERVICE' -LogonType ServiceAccount
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName 'Pokemondle site update' -Action $action -Trigger $trigger -Principal $taskUser -Settings $settings -Force | Out-Null

Get-Service -Name 'PokemondleWeb', 'PokemondleTunnel' | Format-Table Name, Status, StartType
