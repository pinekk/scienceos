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
  echo "未检测到 Bun，请先运行 ./install.sh"
  exit 1
fi

if [[ ! -f "$ROOT/backend/cli/src/web/assets.generated.ts" ]]; then
  echo "scienceos 尚未安装或前端资源不存在，请先运行 ./install.sh"
  exit 1
fi

# scienceos 使用统一登录页，不运行旧版首次启动引导，也不连接旧版自动更新服务。
export OPENSCIENCE_NO_ONBOARD=1
export OPENSCIENCE_DISABLE_AUTOUPDATE=1

cd "$ROOT"
exec "$BUN" run --cwd backend/cli --conditions=browser ./src/index.ts web "$@"
