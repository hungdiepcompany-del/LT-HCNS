@echo off
setlocal EnableExtensions

set "ROOT_DIR=%~dp0"
if exist "%APPDATA%\npm" set "PATH=%APPDATA%\npm;%PATH%"

set "CONFIG_PATH=%ROOT_DIR%deploy.config.psd1"
set "NO_PAUSE="

if /I "%~1"=="--no-pause" (
  set "NO_PAUSE=1"
  shift
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%deploy-all.ps1" -ConfigPath "%CONFIG_PATH%" %*
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
  echo Deploy completed successfully.
) else (
  echo Deploy failed. Exit code: %EXIT_CODE%
)

if not defined NO_PAUSE pause
exit /b %EXIT_CODE%
