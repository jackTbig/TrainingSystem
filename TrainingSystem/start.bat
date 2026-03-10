@echo off
echo ============================================
echo  TrainingSystem - Start Script
echo ============================================

:: Kill old uvicorn processes
echo [1/5] Stopping old uvicorn processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 "') do taskkill /PID %%a /F >/dev/null 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8001 "') do taskkill /PID %%a /F >/dev/null 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8002 "') do taskkill /PID %%a /F >/dev/null 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8003 "') do taskkill /PID %%a /F >/dev/null 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8004 "') do taskkill /PID %%a /F >/dev/null 2>&1
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8005 "') do taskkill /PID %%a /F >/dev/null 2>&1
timeout /t 2 >nul

:: Start Docker
echo [2/5] Starting Docker services...
cd /d "%~dp0infra"
docker compose up -d
timeout /t 3 >nul

:: Start backend
echo [3/5] Starting backend (port 8000)...
cd /d "%~dp0backend"
start "Backend" cmd /k "uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 >nul

:: Start AI Workers
echo [4/5] Starting AI Workers...
cd /d "%~dp0backend"
start "AI Workers" cmd /k "python run_worker.py all"
timeout /t 2 >nul

:: Start frontend
echo [5/5] Starting frontend (port 5173)...
cd /d "%~dp0frontend"
start "Frontend" cmd /k "npm run dev"

echo.
echo ============================================
echo  All services started
echo  Frontend : http://localhost:5173
echo  Backend  : http://localhost:8000
echo  API Docs : http://localhost:8000/docs
echo  Login    : admin / Admin@123
echo ============================================
pause
