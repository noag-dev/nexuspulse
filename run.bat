@echo off
title NexusPulse Engine
echo ===================================================
echo     NEXUSPULSE // AUTONOMOUS REVENUE ENGINE
echo ===================================================
echo Starting FastAPI Engine on http://localhost:8000...
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
pause
