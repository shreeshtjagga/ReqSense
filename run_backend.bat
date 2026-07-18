@echo off
title ReqSense AI - Backend Server
echo [ReqSense] Activating virtual environment...
cd /d "%~dp0backend"
if not exist ".venv\Scripts\activate.bat" (
    echo [ERROR] Virtual environment not found at backend\.venv\
    echo Please create it first using: python -m venv .venv
    pause
    exit /b
)
call .venv\Scripts\activate

echo [ReqSense] Starting Celery worker in a separate window...
start "ReqSense Celery Worker" cmd /k "title ReqSense AI - Celery Worker && cd /d %~dp0backend && call .venv\Scripts\activate && celery -A app.tasks.celery_app worker --loglevel=info"

echo [ReqSense] Starting FastAPI application server...
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
