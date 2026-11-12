@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
set "PORT=8000"

set "PY="
where python >nul 2>nul && set "PY=python"
if not defined PY (
  where py >nul 2>nul && set "PY=py"
)
if not defined PY (
  echo [错误] 未找到 Python 3。
  echo 请先安装 Python 3，或改用其他静态服务器，例如：npx serve .
  pause
  exit /b 1
)

echo.
echo 社会第一课 - 本地预览
echo 地址: http://localhost:%PORT%/
echo 关闭本窗口即停止服务。
echo.

rem 等服务器起来后再打开浏览器，避免白屏
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:%PORT%/"

%PY% -m http.server %PORT%
if errorlevel 1 (
  echo.
  echo [提示] 启动失败。端口 %PORT% 可能已被占用，可换端口：set PORT=8001
  pause
)