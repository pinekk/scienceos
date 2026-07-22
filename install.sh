#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUN="${BUN_BIN:-}"
BUN_HOME="${BUN_INSTALL:-$HOME/.bun}"
RUNTIME="$ROOT/.runtime"

if [[ -n "$BUN" && ! -x "$BUN" ]]; then
  BUN=""
fi

if [[ -z "$BUN" ]]; then
  BUN="$(command -v bun || true)"
fi

if [[ -z "$BUN" && -x "$BUN_HOME/bin/bun" ]]; then
  BUN="$BUN_HOME/bin/bun"
fi

if [[ -z "$BUN" && -x "$RUNTIME/node_modules/.bin/bun" ]]; then
  BUN="$RUNTIME/node_modules/.bin/bun"
fi

if [[ -z "$BUN" ]]; then
  if [[ -n "$(command -v npm || true)" ]]; then
    echo "正在通过 npm 将 Bun 安装到项目的 .runtime 目录"
    if npm install --prefix "$RUNTIME" --no-audit --no-fund bun@latest; then
      if [[ -x "$RUNTIME/node_modules/.bin/bun" ]]; then
        BUN="$RUNTIME/node_modules/.bin/bun"
      fi
    fi
  fi
fi

if [[ -z "$BUN" ]]; then
  if command -v curl >/dev/null 2>&1; then
    echo "未检测到 Bun，正在通过官方安装程序安装"
    if curl -fsSL --connect-timeout 15 --max-time 180 https://bun.sh/install | bash; then
      if [[ -x "$BUN_HOME/bin/bun" ]]; then
        BUN="$BUN_HOME/bin/bun"
      fi
    else
      echo "Bun 官方安装失败。"
    fi
  fi
fi

if [[ -z "$BUN" || ! -x "$BUN" ]]; then
  echo "无法自动安装 Bun。"
  echo "请先参考 https://bun.sh 安装 Bun，或安装 Node.js/npm 后重新运行 ./install.sh"
  exit 1
fi

echo "scienceos 安装目录：$ROOT"
echo "Bun：$("$BUN" --version)"

cd "$ROOT"

echo "[1/3] 安装项目依赖"
"$BUN" install --frozen-lockfile

echo "[2/3] 构建 scienceos 前端"
"$BUN" run --cwd frontend/workspace build

echo "[3/3] 生成本地后端内嵌资源"
"$BUN" run --cwd backend/cli script/generate-web-assets.ts

echo
echo "scienceos 安装完成。"
echo "运行以下命令启动："
echo "  ./start.sh"
