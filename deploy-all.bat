@echo off
setlocal EnableExtensions

set "ROOT_DIR=%~dp0"
if exist "%APPDATA%\npm" set "PATH=%APPDATA%\npm;%PATH%"

set "CONFIG_PATH=%ROOT_DIR%deploy.config.psd1"
set "NO_PAUSE="
set "PS_ARGS="

:parse_args
if "%~1"=="" goto run_deploy
if /I "%~1"=="--no-pause" (
  set "NO_PAUSE=1"
) else (
  set "PS_ARGS=%PS_ARGS% %1"
)
shift
goto parse_args

:run_deploy
powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT_DIR%deploy-all.ps1" -ConfigPath "%CONFIG_PATH%" %PS_ARGS%
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if "%EXIT_CODE%"=="0" (
  echo Deploy completed successfully.
) else (
  echo Deploy failed. Exit code: %EXIT_CODE%
)

if not defined NO_PAUSE pause
exit /b %EXIT_CODE%
