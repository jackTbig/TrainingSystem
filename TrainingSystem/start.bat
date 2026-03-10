@echo off
echo ============================================
echo  TrainingSystem - Start Script
echo ============================================

:: Kill old processes on port 8000
echo [1/5] Stopping old processes...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 "') do taskkill /PID %%a /F 2>nul
timeout /t 2 >nul

:: Check/Start Docker Desktop
echo [2/5] Checking Docker...
docker info >nul
if errorlevel 1 (
    echo   Starting Docker Desktop, please wait...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    :waitdocker
    timeout /t 4 >nul
    docker info >nul
    if errorlevel 1 goto waitdocker
    echo   Docker is ready.
)

:: Start Docker containers
echo   Starting containers...
cd /d "%~dp0infra"
docker compose up -d
timeout /t 5 >nul

:: Start backend
echo [3/5] Starting backend (port 8000)...
cd /d "%~dp0backend"
start "Backend" cmd /k "uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 4 >nul

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
echo  All services started.
echo  Frontend : http://localhost:5173
echo  Backend  : http://localhost:8000
echo  API Docs : http://localhost:8000/docs
echo  Login    : admin / Admin@123
echo ============================================
pause
