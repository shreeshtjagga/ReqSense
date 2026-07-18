@echo off
title ReqSense AI Launcher
echo ==========================================
echo       ReqSense AI Full-Stack Launcher
echo ==========================================
echo.
echo [ReqSense] Starting backend services...
start "ReqSense Backend" cmd /c "%~dp0run_backend.bat"

echo [ReqSense] Starting frontend services...
start "ReqSense Frontend" cmd /c "%~dp0run_frontend.bat"

echo.
echo [SUCCESS] Both backend and frontend services have been launched!
echo Keep the command windows open while working.
echo.
timeout /t 5
