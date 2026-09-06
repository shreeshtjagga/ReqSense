@echo off
echo Starting ReqSense AI Backend (FastAPI on port 8000)...
cd /d "%~dp0backend"
.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
pause
