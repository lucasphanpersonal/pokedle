# Installs the newest site build from the rolling "site-latest" GitHub release.
# Does nothing when the installed build is already current, so it is safe to run every few minutes.
# deploy.yml publishes the bundle only after lint, tests and the build have passed on main.
[CmdletBinding()]
param(
    [string]$Root = 'C:\ProgramData\Pokemondle',
    [string]$Repo = 'lucasphanpersonal/pokemondle'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$site = Join-Path $Root 'site'
$releases = Join-Path $site 'releases'
$current = Join-Path $site 'current'
$state = Join-Path $site 'deployed.txt'
$log = Join-Path $Root 'logs\update.log'

function Write-Log([string]$Message) {
    Add-Content -Path $log -Value ('{0:u} {1}' -f (Get-Date).ToUniversalTime(), $Message)
}

try {
    New-Item -ItemType Directory -Force -Path $releases | Out-Null

    $release = Invoke-RestMethod -Headers @{ 'User-Agent' = 'pokemondle-updater' } `
        -Uri "https://api.github.com/repos/$Repo/releases/tags/site-latest"
    $asset = $release.assets | Where-Object { $_.name -eq 'site.zip' }
    if (-not $asset) { throw 'site.zip is missing from the site-latest release' }
    if ($asset.digest -notmatch '^sha256:([0-9a-f]{64})$') { throw "unexpected asset digest: $($asset.digest)" }
    $hash = $Matches[1]

    $installed = if (Test-Path $state) { (Get-Content $state -Raw).Trim() } else { '' }
    if ($installed -eq $hash -and (Test-Path (Join-Path $current 'index.html'))) { exit 0 }

    $target = Join-Path $releases $hash
    $zip = Join-Path $site "$hash.zip"
    $staging = "$target.tmp"
    if (Test-Path $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }

    Invoke-WebRequest -UseBasicParsing -Uri $asset.browser_download_url -OutFile $zip
    $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $zip).Hash.ToLowerInvariant()
    if ($actual -ne $hash) { throw "download hash $actual does not match $hash" }

    Expand-Archive -LiteralPath $zip -DestinationPath $staging
    Remove-Item -LiteralPath $zip
    if (-not (Test-Path (Join-Path $staging 'index.html')) -or -not (Test-Path (Join-Path $staging 'assets'))) {
        throw 'bundle has no index.html or assets folder'
    }

    # [IO.Directory]::Delete removes only the junction, never the release it points at.
    if (Test-Path $current) { [IO.Directory]::Delete($current) }
    if (Test-Path $target) { Remove-Item -LiteralPath $target -Recurse -Force }
    Rename-Item -LiteralPath $staging -NewName $hash
    New-Item -ItemType Junction -Path $current -Target $target | Out-Null
    Set-Content -Path $state -Value $hash

    # Keep the new build and the one before it.
    Get-ChildItem -Directory -Path $releases |
        Where-Object { $_.Name -ne $hash } |
        Sort-Object CreationTimeUtc -Descending |
        Select-Object -Skip 1 |
        ForEach-Object { Remove-Item -LiteralPath $_.FullName -Recurse -Force }

    Write-Log "installed $hash"
}
catch {
    Write-Log "FAILED: $($_.Exception.Message)"
    throw
}
