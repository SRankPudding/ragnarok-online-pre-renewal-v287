param([string]$ServerHost = 'localhost')
$ErrorActionPreference = 'Stop'
$engine = Join-Path $PSScriptRoot 'build'
$assets = Join-Path $PSScriptRoot 'assets'
$electron = Join-Path $engine 'node_modules/electron/dist/electron.exe'
if (!(Test-Path -LiteralPath $electron)) { throw 'Run prepare-client.ps1 first.' }
if (!(Test-Path -LiteralPath (Join-Path $assets 'data.grf'))) { throw 'Supply a compatible data.grf in client/assets.' }
$env:RO_SERVER_HOST = $ServerHost
$env:RO_CLIENT_PROFILE = Join-Path $PSScriptRoot 'profile'
Push-Location $assets
try {
	& $electron (Join-Path $engine 'applications/electron/main.js')
} finally {
	Pop-Location
	Remove-Item Env:RO_SERVER_HOST,Env:RO_CLIENT_PROFILE -ErrorAction SilentlyContinue
}
