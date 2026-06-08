@echo off
REM ============================================================
REM LT-HCNS - SAFE GOOGLE APPS SCRIPT PULL TO gas-upload
REM This script intentionally relaunches itself with cmd /k so the
REM window stays open even if an unexpected error happens.
REM ============================================================

if /I "%~1" NEQ "__RUN__" (
  cmd /k ""%~f0" __RUN__"
  exit /b
)

setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title LT-HCNS - GAS PULL - ALWAYS WAIT

set "ROOT_DIR=D:\CODE\HanhChinh-NhanSu"
set "GAS_DIR=%ROOT_DIR%\gas-upload"
set "LOG_DIR=%ROOT_DIR%\_gas_pull_logs"
set "BACKUP_ROOT=%ROOT_DIR%\_gas_backups"
set "DEFAULT_SCRIPT_ID=15f9pVa8i23lXOQEy3AnCkG-wVzZJiZN6qmdwShIH1jYpbGnPfiatfXfw"

for /f %%I in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Date -Format yyyyMMdd_HHmmss"') do set "TS=%%I"

set "LOG_FILE=%LOG_DIR%\gas_pull_final_%TS%.log"
set "BACKUP_DIR=%BACKUP_ROOT%\gas_upload_backup_before_pull_%TS%"
set "LEGACY_GS_DIR=%BACKUP_DIR%\legacy_gs_files_moved_before_pull"
set "FINAL_STATUS=FAILED"
set "FINAL_MESSAGE=Script stopped before completion."
set "PULL_OK=0"
set "MOVED_GS_COUNT=0"

echo ============================================================
echo  LT-HCNS - SAFE GOOGLE APPS SCRIPT PULL TO gas-upload
echo ============================================================
echo  Root folder : %ROOT_DIR%
echo  GAS folder  : %GAS_DIR%
echo  Action      : clasp pull after backup and conflict cleanup
echo  Safety      : backup first, no push, no git operation
echo  Window      : always stays open at the end
echo ============================================================

if not exist "%ROOT_DIR%" mkdir "%ROOT_DIR%" >nul 2>&1
if not exist "%GAS_DIR%" mkdir "%GAS_DIR%" >nul 2>&1
if not exist "%LOG_DIR%" mkdir "%LOG_DIR%" >nul 2>&1
if not exist "%BACKUP_ROOT%" mkdir "%BACKUP_ROOT%" >nul 2>&1

echo [%DATE% %TIME%] START > "%LOG_FILE%"
echo Root folder: %ROOT_DIR% >> "%LOG_FILE%"
echo GAS folder : %GAS_DIR% >> "%LOG_FILE%"

echo.
echo ============================================================
echo  STEP 1/10 - CHECK WORKING FOLDER
echo ============================================================
cd /d "%GAS_DIR%"
if errorlevel 1 (
  set "FINAL_MESSAGE=Cannot open GAS folder: %GAS_DIR%"
  goto FINAL
)
echo [OK] Working folder: %CD%
echo [OK] Working folder: %CD% >> "%LOG_FILE%"

echo.
echo ============================================================
echo  STEP 2/10 - CHECK NODE.JS, NPM, CLASP
echo ============================================================

where node >nul 2>&1
if errorlevel 1 (
  set "FINAL_MESSAGE=Node.js not found. Install Node.js first."
  goto FINAL
)
for /f "tokens=*" %%V in ('node -v 2^>nul') do set "NODE_VER=%%V"
echo [OK] Node.js: %NODE_VER%
echo [OK] Node.js: %NODE_VER% >> "%LOG_FILE%"

where npm >nul 2>&1
if errorlevel 1 (
  set "FINAL_MESSAGE=npm not found. Reinstall Node.js with npm."
  goto FINAL
)
for /f "tokens=*" %%V in ('npm -v 2^>nul') do set "NPM_VER=%%V"
echo [OK] npm: %NPM_VER%
echo [OK] npm: %NPM_VER% >> "%LOG_FILE%"

where clasp >nul 2>&1
if errorlevel 1 (
  echo [WARN] clasp not found. Installing @google/clasp globally...
  echo [WARN] clasp not found. Installing @google/clasp globally... >> "%LOG_FILE%"
  call npm install -g @google/clasp >> "%LOG_FILE%" 2>&1
  if errorlevel 1 (
    set "FINAL_MESSAGE=Cannot install @google/clasp. Try manually: npm install -g @google/clasp"
    goto FINAL
  )
)

for /f "tokens=*" %%V in ('clasp --version 2^>nul') do set "CLASP_VER=%%V"
echo [OK] clasp: %CLASP_VER%
echo [OK] clasp: %CLASP_VER% >> "%LOG_FILE%"

echo.
echo ============================================================
echo  STEP 3/10 - LOGIN / API NOTE
echo ============================================================
echo If auth/API error appears:
echo   1. Run: clasp logout
echo   2. Run: Remove-Item "$env:USERPROFILE\.clasprc.json" -Force -ErrorAction SilentlyContinue
echo   3. Run: clasp login
echo   4. Login with hr@longthaisteel.com or an Editor account
echo   5. Open https://script.google.com/home/usersettings
echo   6. Enable Google Apps Script API
echo.
echo Note: this script does NOT run "clasp login --status" because clasp 3.3 may not support it.

echo.
echo ============================================================
echo  STEP 4/10 - CHECK .clasp.json
echo ============================================================
if not exist "%GAS_DIR%\.clasp.json" (
  echo [WARN] .clasp.json not found in gas-upload.
  echo Default Script ID:
  echo   %DEFAULT_SCRIPT_ID%
  choice /C YN /M "Use default Script ID"
  if errorlevel 2 (
    set /p "SCRIPT_ID=Paste Script ID here: "
  ) else (
    set "SCRIPT_ID=%DEFAULT_SCRIPT_ID%"
  )

  if "!SCRIPT_ID!"=="" (
    set "FINAL_MESSAGE=Empty Script ID."
    goto FINAL
  )

  > "%GAS_DIR%\.clasp.json" echo {"scriptId":"!SCRIPT_ID!","rootDir":"."}
)

echo Current .clasp.json:
type "%GAS_DIR%\.clasp.json"
echo. >> "%LOG_FILE%"
echo Current .clasp.json: >> "%LOG_FILE%"
type "%GAS_DIR%\.clasp.json" >> "%LOG_FILE%" 2>&1

echo.
echo ============================================================
echo  STEP 5/10 - BACKUP CURRENT gas-upload
echo ============================================================
echo Creating backup:
echo   %BACKUP_DIR%
mkdir "%BACKUP_DIR%" >nul 2>&1

robocopy "%GAS_DIR%" "%BACKUP_DIR%" /E ^
  /XD ".git" "node_modules" ".next" "dist" "build" ^
  /XF "*.log" >> "%LOG_FILE%" 2>&1

set "ROBO_RESULT=%ERRORLEVEL%"
if %ROBO_RESULT% GEQ 8 (
  set "FINAL_MESSAGE=Backup failed. Robocopy exit code: %ROBO_RESULT%"
  goto FINAL
)
echo [OK] Backup created.
echo [OK] Backup created: %BACKUP_DIR% >> "%LOG_FILE%"

echo.
echo ============================================================
echo  STEP 6/10 - MOVE LEGACY .gs FILES TO BACKUP
echo ============================================================
echo Old local *.gs files can conflict with clasp v3 pull output.
echo This step moves them to backup. It does NOT delete them.
echo.
echo Legacy .gs backup:
echo   %LEGACY_GS_DIR%
mkdir "%LEGACY_GS_DIR%" >nul 2>&1

for %%F in ("%GAS_DIR%\*.gs") do (
  if exist "%%~fF" (
    echo Moving legacy file: %%~nxF
    echo Moving legacy file: %%~nxF >> "%LOG_FILE%"
    move /Y "%%~fF" "%LEGACY_GS_DIR%\" >> "%LOG_FILE%" 2>&1
    set /a MOVED_GS_COUNT+=1
  )
)

echo [OK] Legacy .gs files moved: !MOVED_GS_COUNT!
echo [OK] Legacy .gs files moved: !MOVED_GS_COUNT! >> "%LOG_FILE%"

echo.
echo ============================================================
echo  STEP 7/10 - CLASP STATUS
echo ============================================================
echo Running: clasp status
echo Running: clasp status >> "%LOG_FILE%"
call clasp status
call clasp status >> "%LOG_FILE%" 2>&1
if errorlevel 1 (
  echo [WARN] clasp status returned a warning/error. Pull will still be attempted.
  echo [WARN] Check account/API/project permission if pull fails.
  echo [WARN] clasp status returned a warning/error. >> "%LOG_FILE%"
)

echo.
echo ============================================================
echo  STEP 8/10 - PULL FROM GOOGLE APPS SCRIPT
echo ============================================================
echo This will run:
echo   clasp pull
echo.
echo If conflict still appears, this script will try:
echo   clasp pull --force
echo   clasp pull -f
echo.
echo Safety:
echo   - Backup was created
echo   - Legacy .gs files were moved to backup, not deleted
echo   - No clasp push
echo.
choice /C YN /M "Continue with clasp pull"
if errorlevel 2 (
  set "FINAL_STATUS=CANCELLED"
  set "FINAL_MESSAGE=User cancelled before clasp pull."
  goto FINAL
)

echo Running: clasp pull
echo Running: clasp pull >> "%LOG_FILE%"
call clasp pull >> "%LOG_FILE%" 2>&1
set "PULL_EXIT=%ERRORLEVEL%"

if not "%PULL_EXIT%"=="0" (
  echo [WARN] clasp pull failed. Trying clasp pull --force...
  echo [WARN] clasp pull failed. Trying clasp pull --force... >> "%LOG_FILE%"
  call clasp pull --force >> "%LOG_FILE%" 2>&1
  set "PULL_EXIT=%ERRORLEVEL%"
)

if not "%PULL_EXIT%"=="0" (
  echo [WARN] clasp pull --force failed. Trying clasp pull -f...
  echo [WARN] clasp pull --force failed. Trying clasp pull -f... >> "%LOG_FILE%"
  call clasp pull -f >> "%LOG_FILE%" 2>&1
  set "PULL_EXIT=%ERRORLEVEL%"
)

if not "%PULL_EXIT%"=="0" (
  echo.
  echo [ERROR] clasp pull failed.
  echo Showing last 100 log lines:
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Content -LiteralPath '%LOG_FILE%' -Tail 100"
  echo.
  set "FINAL_MESSAGE=clasp pull failed. Check log."
  goto FINAL
)

set "PULL_OK=1"
echo [OK] clasp pull completed.
echo [OK] clasp pull completed. >> "%LOG_FILE%"

echo.
echo ============================================================
echo  STEP 9/10 - LIST SAVED FILES
echo ============================================================
echo Files now in:
echo   %GAS_DIR%
echo.
dir /b "%GAS_DIR%"
dir /b "%GAS_DIR%" >> "%LOG_FILE%" 2>&1

echo.
echo ============================================================
echo  STEP 10/10 - SUCCESS SUMMARY
echo ============================================================
set "FINAL_STATUS=SUCCESS"
set "FINAL_MESSAGE=Google Apps Script code was pulled successfully."

:FINAL
echo.
echo ============================================================
echo  FINAL RESULT
echo ============================================================
echo  Status : %FINAL_STATUS%
echo  Message: %FINAL_MESSAGE%
echo.
echo  GAS folder:
echo    %GAS_DIR%
echo.
echo  Backup:
echo    %BACKUP_DIR%
echo.
echo  Legacy .gs backup:
echo    %LEGACY_GS_DIR%
echo.
echo  Log:
echo    %LOG_FILE%
echo.
if "%PULL_OK%"=="1" (
  echo  Result:
  echo    Pull completed successfully.
  echo    Review local files before editing or pushing.
) else (
  echo  Result:
  echo    Pull was not completed successfully.
  echo    Read the log above before trying again.
)
echo.
echo  This script did NOT push anything to Google Apps Script.
echo  This window will stay open because it was launched through cmd /k.
echo ============================================================
echo.

>> "%LOG_FILE%" echo.
>> "%LOG_FILE%" echo FINAL STATUS: %FINAL_STATUS%
>> "%LOG_FILE%" echo FINAL MESSAGE: %FINAL_MESSAGE%
>> "%LOG_FILE%" echo END: [%DATE% %TIME%]

echo Press any key to close this window...
pause >nul
exit /b 0
