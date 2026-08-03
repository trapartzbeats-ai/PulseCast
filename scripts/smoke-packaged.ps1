$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$packageJson = Get-Content -Raw (Join-Path $projectRoot "package.json") | ConvertFrom-Json
$executableName = $packageJson.build.win.executableName
$productName = $packageJson.build.productName
$releaseDirectory = $packageJson.build.directories.output
$releaseRoot = Join-Path $projectRoot $releaseDirectory
$latestPath = Join-Path $releaseRoot "latest.json"
if (-not (Test-Path -LiteralPath $latestPath -PathType Leaf)) {
  throw "Package pointer was not found at $latestPath"
}
$latest = Get-Content -Raw $latestPath | ConvertFrom-Json
$appPath = Join-Path $releaseRoot "$($latest.buildDirectory)\win-unpacked\$executableName.exe"
$smokeData = [System.IO.Path]::GetFullPath(
  (Join-Path $projectRoot ("reports\runtime\packaged-smoke-" + (Get-Date -Format "yyyyMMdd-HHmmss")))
)

if (-not $smokeData.StartsWith(
  [System.IO.Path]::GetFullPath($projectRoot),
  [System.StringComparison]::OrdinalIgnoreCase
)) {
  throw "Packaged smoke data escaped the project root: $smokeData"
}

if (-not (Test-Path -LiteralPath $appPath -PathType Leaf)) {
  throw "Packaged executable was not found at $appPath"
}

$env:PULSECAST_DATA_DIR = $smokeData
$appProcess = Start-Process `
  -FilePath $appPath `
  -WorkingDirectory (Split-Path -Parent $appPath) `
  -PassThru

$window = $null
for ($attempt = 0; $attempt -lt 60; $attempt++) {
  Start-Sleep -Milliseconds 250
  $window = Get-Process -Id $appProcess.Id -ErrorAction SilentlyContinue
  if ($null -eq $window) {
    break
  }
  if ($window.MainWindowHandle -ne 0) {
    break
  }
}

$openedRealWindow = (
  $null -ne $window -and
  $window.MainWindowHandle -ne 0 -and
  $window.MainWindowTitle -like "$productName*"
)

$workingState = Join-Path $smokeData "shows\foundation-flagship\working-state.json"
$checkpoint = Join-Path $smokeData "shows\foundation-flagship\recovery\checkpoint.json"
$sessionLock = Join-Path $smokeData "shows\foundation-flagship\recovery\session.lock"

$closeRequested = $false
$exitedCleanly = $false
if ($null -ne $window) {
  $closeRequested = $window.CloseMainWindow()
  $exitedCleanly = $appProcess.WaitForExit(10000)
}

if (-not $exitedCleanly -and -not $appProcess.HasExited) {
  Stop-Process -Id $appProcess.Id -Force
}

Start-Sleep -Milliseconds 500

$result = [ordered]@{
  schema = "pulsecast.packaged-smoke/v1"
  executable = $appPath
  openedRealWindow = $openedRealWindow
  windowTitle = if ($null -ne $window) { $window.MainWindowTitle } else { "" }
  closeRequested = $closeRequested
  exitedWithin10Seconds = $exitedCleanly
  workingStateExists = Test-Path -LiteralPath $workingState -PathType Leaf
  checkpointExists = Test-Path -LiteralPath $checkpoint -PathType Leaf
  sessionLockRemoved = -not (Test-Path -LiteralPath $sessionLock)
}

$result | ConvertTo-Json

$passed = (
  $result.openedRealWindow -and
  $result.closeRequested -and
  $result.exitedWithin10Seconds -and
  $result.workingStateExists -and
  $result.checkpointExists -and
  $result.sessionLockRemoved
)

if (-not $passed) {
  exit 1
}

