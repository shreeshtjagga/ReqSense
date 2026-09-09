@echo off
title ReqSense AI - Frontend [Port 5173]
echo  Starting ReqSense AI Frontend (Vite)...
echo.

cd /d "%~dp0frontend"

if not exist "node_modules" (
    echo  [INFO] Installing dependencies...
    npm install
)

npm run dev
if errorlevel 1 (
    echo.
    echo  [ERROR] Frontend server exited with an error.
    pause
    exit /b 1
)
pause
