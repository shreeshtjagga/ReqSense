@echo off
title ReqSense AI - Frontend Server
echo [ReqSense] Opening browser to localhost URL...
start http://localhost:5173

echo [ReqSense] Starting Vite development server...
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo [ReqSense] node_modules not found, running npm install...
    call npm install
)
npm run dev
