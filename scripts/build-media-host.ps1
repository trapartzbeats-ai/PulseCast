$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $projectRoot "services\media-host"
$build = Join-Path $projectRoot "build\media-host"

& cmake -S $source -B $build -A x64
if ($LASTEXITCODE -ne 0) {
  throw "Media Host configure failed with exit code $LASTEXITCODE."
}

& cmake --build $build --config Release --parallel
if ($LASTEXITCODE -ne 0) {
  throw "Media Host build failed with exit code $LASTEXITCODE."
}

& ctest --test-dir $build -C Release --output-on-failure
if ($LASTEXITCODE -ne 0) {
  throw "Media Host tests failed with exit code $LASTEXITCODE."
}

$executable = Join-Path $build "Release\PulseCastMediaHost.exe"
& $executable --probe-json
if ($LASTEXITCODE -ne 0) {
  throw "Media Host one-shot probe failed with exit code $LASTEXITCODE."
}

$serveOutput = @(
  '{"schema":"pulsecast.media-host-command/v1","type":"probe"}'
  '{"schema":"pulsecast.media-host-command/v1","type":"shutdown"}'
) | & $executable --serve
if ($LASTEXITCODE -ne 0) {
  throw "Media Host serve contract failed with exit code $LASTEXITCODE."
}
if ($serveOutput.Count -ne 2 -or
    $serveOutput[0] -notmatch 'pulsecast.media-host-probe/v1' -or
    $serveOutput[1] -notmatch 'shutdown-complete') {
  throw "Media Host serve contract returned an invalid response sequence."
}
