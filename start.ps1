$ErrorActionPreference = "Stop"

$Root = $PSScriptRoot
$BunHome = if ($env:BUN_INSTALL) { $env:BUN_INSTALL } else { Join-Path $env:USERPROFILE ".bun" }
$Runtime = Join-Path $Root ".runtime"
$Bun = if ($env:BUN_BIN -and (Test-Path $env:BUN_BIN)) { $env:BUN_BIN } else { $null }

if (-not $Bun) {
  $Command = Get-Command bun -ErrorAction SilentlyContinue
  if ($Command) {
    $Bun = $Command.Source
  }
}

if (-not $Bun) {
  $Candidate = Join-Path $BunHome "bin\bun.exe"
  if (Test-Path $Candidate) {
    $Bun = $Candidate
  }
}

if (-not $Bun) {
  $Candidate = Join-Path $Runtime "node_modules\.bin\bun.cmd"
  if (Test-Path $Candidate) {
    $Bun = $Candidate
  }
}

if (-not $Bun) {
  Write-Error "未检测到 Bun，请先运行 .\install.ps1"
}

$Assets = Join-Path $Root "backend\cli\src\web\assets.generated.ts"
if (-not (Test-Path $Assets)) {
  Write-Error "scienceos 尚未安装或前端资源不存在，请先运行 .\install.ps1"
}

# scienceos 使用统一登录页，不运行旧版首次启动引导，也不连接旧版自动更新服务。
$env:OPENSCIENCE_NO_ONBOARD = "1"
$env:OPENSCIENCE_DISABLE_AUTOUPDATE = "1"

Push-Location $Root
try {
  & $Bun run --cwd backend/cli --conditions=browser ./src/index.ts web @args
  $Code = $LASTEXITCODE
}
finally {
  Pop-Location
}

exit $Code
