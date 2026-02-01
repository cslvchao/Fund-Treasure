@echo off
chcp 65001 >nul
echo ========================================
echo    停止基金估值服务...
echo ========================================
echo.

taskkill /F /FI "WINDOWTITLE eq 基金估值-代理服务器*" >nul 2>&1
taskkill /F /IM node.exe >nul 2>&1

echo 服务已停止！
echo.
pause
