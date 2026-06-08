@echo off
setlocal EnableExtensions

echo [DEPRECATED WRAPPER] deploy.bat delegates to deploy-all.bat.
echo [INFO] Official deploy command: deploy-all.bat

call "%~dp0deploy-all.bat" %*
exit /b %ERRORLEVEL%
