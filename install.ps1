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
  $Npm = Get-Command npm -ErrorAction SilentlyContinue
  if ($Npm) {
    Write-Host "正在通过 npm 将 Bun 安装到项目的 .runtime 目录"
    & $Npm.Source install --prefix $Runtime --no-audit --no-fund bun@latest
    if ($LASTEXITCODE -eq 0) {
      $Candidate = Join-Path $Runtime "node_modules\.bin\bun.cmd"
      if (Test-Path $Candidate) {
        $Bun = $Candidate
      }
    }
  }
}

if (-not $Bun) {
  Write-Host "未检测到 Bun，正在通过官方安装程序安装"
  try {
    $Installer = Invoke-RestMethod "https://bun.sh/install.ps1" -TimeoutSec 180
    Invoke-Expression $Installer
  }
  catch {
    Write-Warning "Bun 官方安装失败。"
  }
  $Candidate = Join-Path $BunHome "bin\bun.exe"
  if (Test-Path $Candidate) {
    $Bun = $Candidate
  }
}

if (-not $Bun -or -not (Test-Path $Bun)) {
  Write-Error "无法自动安装 Bun。请先安装 Bun，或安装 Node.js/npm 后重新运行 .\install.ps1"
}

function Invoke-Bun {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$BunArgs)

  & $script:Bun @BunArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Bun 命令执行失败，退出码：$LASTEXITCODE"
  }
}

Write-Host "scienceos 安装目录：$Root"
Write-Host "Bun：$(& $Bun --version)"

Push-Location $Root
try {
  Write-Host "[1/3] 安装项目依赖"
  Invoke-Bun install --frozen-lockfile

  Write-Host "[2/3] 构建 scienceos 前端"
  Invoke-Bun run --cwd frontend/workspace build

  Write-Host "[3/3] 生成本地后端内嵌资源"
  Invoke-Bun run --cwd backend/cli script/generate-web-assets.ts
}
finally {
  Pop-Location
}

Write-Host ""
Write-Host "scienceos 安装完成。"
Write-Host "运行以下命令启动："
Write-Host "  .\start.ps1"
