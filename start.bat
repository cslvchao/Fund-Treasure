@echo off
chcp 65001 >nul
echo ========================================
echo    基金实时估值工具 - 启动中...
echo ========================================
echo.

echo [1/3] 检查依赖...
if not exist "node_modules\" (
    echo 首次运行，正在安装依赖...
    call npm install
    echo.
)

echo [2/3] 启动代理服务器...
start "基金估值-代理服务器" cmd /k "node proxy-server.js"
timeout /t 2 /nobreak >nul

echo [3/3] 打开浏览器...
start "" "index.html"

echo.
echo ========================================
echo    启动完成！
echo    - 浏览器已打开
echo    - 代理服务器运行在 http://localhost:3000
echo    - 关闭服务器窗口即可停止服务
echo ========================================
echo.
pause
