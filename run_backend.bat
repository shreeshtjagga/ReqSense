@echo off
title ReqSense AI - Backend Server [Port 8000]
echo.
echo  Starting ReqSense AI Backend...
echo.

cd /d "%~dp0backend"

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found!
    echo Run: python -m venv .venv  ^&^&  .venv\Scripts\pip install -r requirements.txt
    pause
    exit /b 1
)

echo  [1/2] Pre-flight connection check...
.venv\Scripts\python.exe check_connections.py
if errorlevel 1 (
    echo.
    echo [WARNING] A connection check failed. Check details above.
    choice /c YN /m "Start the server anyway"
    if errorlevel 2 exit /b 1
)

echo.
echo  [2/2] Starting FastAPI server on http://127.0.0.1:8000
echo         API Docs: http://127.0.0.1:8000/docs
echo  Press Ctrl+C to stop.
echo.

.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
if errorlevel 1 (
    echo.
    echo  [ERROR] Server exited with an error. See output above.
    pause
    exit /b 1
)
pause
