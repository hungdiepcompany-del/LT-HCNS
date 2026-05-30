@echo off
cd /d D:\HanhChinh-NhanSu

echo =========================
echo Build version...
echo =========================

node inject-version.js

echo =========================
echo Deploy Firebase...
echo =========================

firebase deploy --only hosting

echo DONE
pause