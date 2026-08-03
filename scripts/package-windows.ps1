param(
  [switch]$DirectoryOnly
)

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$packageJsonPath = Join-Path $projectRoot "package.json"
$packageJson = Get-Content -Raw $packageJsonPath | ConvertFrom-Json
$releaseRoot = [System.IO.Path]::GetFullPath(
  (Join-Path $projectRoot $packageJson.build.directories.output)
)
$tempRoot = [System.IO.Path]::GetFullPath(
  (Join-Path $env:TEMP ("PulseCast-package-" + [Guid]::NewGuid().ToString("N")))
)
$buildId = "build-" + (Get-Date -Format "yyyyMMdd-HHmmss")
$destination = [System.IO.Path]::GetFullPath((Join-Path $releaseRoot $buildId))

if (-not $releaseRoot.StartsWith(
  [System.IO.Path]::GetFullPath($projectRoot),
  [System.StringComparison]::OrdinalIgnoreCase
)) {
  throw "Release root escaped the project: $releaseRoot"
}

& npm.cmd run build
if ($LASTEXITCODE -ne 0) {
  throw "PulseCast build failed with exit code $LASTEXITCODE."
}

$builderArgs = @(
  "electron-builder",
  "--win"
)
if ($DirectoryOnly) {
  $builderArgs += "dir"
} else {
  $builderArgs += @("nsis", "portable")
}
$builderArgs += @(
  "--x64",
  "--config.directories.output=$tempRoot"
)

& npx.cmd @builderArgs
if ($LASTEXITCODE -ne 0) {
  throw "Electron packaging failed with exit code $LASTEXITCODE."
}

New-Item -ItemType Directory -Force -Path $destination | Out-Null
Copy-Item -Path (Join-Path $tempRoot "*") -Destination $destination -Recurse -Force

$manifest = [ordered]@{
  schema = "pulsecast.package-pointer/v1"
  createdAt = (Get-Date).ToUniversalTime().ToString("o")
  version = $packageJson.version
  buildDirectory = $buildId
  executable = "win-unpacked\$($packageJson.build.win.executableName).exe"
  directoryOnly = [bool]$DirectoryOnly
}
New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
[System.IO.File]::WriteAllText(
  (Join-Path $releaseRoot "latest.json"),
  ($manifest | ConvertTo-Json)
)

$manifest | ConvertTo-Json
