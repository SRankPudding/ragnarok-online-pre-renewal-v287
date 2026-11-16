$ErrorActionPreference = 'Stop'
$revision = '2ec8f82c8ea77cc3a50b900eb0b71b1cbe34c9a6'
$build = Join-Path $PSScriptRoot 'build'
if (Test-Path -LiteralPath $build) { throw 'client/build exists. Use a fresh checkout for this setup.' }
git init "$build"
if ($LASTEXITCODE) { throw 'git init failed' }
git -C "$build" fetch --depth=1 https://github.com/MrAntares/roBrowserLegacy.git $revision
if ($LASTEXITCODE) { throw 'Could not fetch pinned roBrowserLegacy source' }
git -C "$build" checkout --detach FETCH_HEAD
if ($LASTEXITCODE -or (git -C "$build" rev-parse HEAD) -ne $revision) { throw 'Unexpected source revision' }
Copy-Item -Path (Join-Path $PSScriptRoot 'overlay/*') -Destination $build -Recurse -Force
New-Item -ItemType Directory -Path (Join-Path $PSScriptRoot 'assets') -Force | Out-Null
Push-Location $build
try {
	npm.cmd install --save-dev --save-exact electron@41.2.0
	if ($LASTEXITCODE) { throw 'Dependency installation failed' }
} finally {
	Pop-Location
}
