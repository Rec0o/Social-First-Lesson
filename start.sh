#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

PORT="${PORT:-8000}"

if command -v python3 >/dev/null 2>&1; then
  PY=python3
elif command -v python >/dev/null 2>&1; then
  PY=python
else
  echo "[错误] 未找到 python3 / python，请先安装 Python 3。"
  exit 1
fi

echo "社会第一课 - 本地预览"
echo "地址: http://localhost:${PORT}/"
echo "按 Ctrl+C 停止服务。"
echo

(
  sleep 1
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:${PORT}/" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "http://localhost:${PORT}/" >/dev/null 2>&1 || true
  fi
) &

exec "$PY" -m http.server "$PORT"