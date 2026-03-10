@echo off
echo ============================================
echo  培训考试系统 - 启动脚本
echo ============================================

:: 结束所有旧的 uvicorn 进程
echo [1/5] 停止旧 uvicorn 进程...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8001 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8002 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8003 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8004 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8005 "') do (
    taskkill /PID %%a /F >nul 2>&1
)
timeout /t 2 >nul

:: 确保 Docker 容器运行
echo [2/5] 启动 Docker 服务...
cd /d "%~dp0infra"
docker compose up -d
timeout /t 3 >nul

:: 启动后端
echo [3/5] 启动后端 (port 8000)...
cd /d "%~dp0backend"
start "TrainingSystem Backend" cmd /k "uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
timeout /t 3 >nul

:: 启动 AI Workers
echo [4/5] 启动 AI Workers...
cd /d "%~dp0backend"
start "TrainingSystem AI Workers" cmd /k "python run_worker.py all"
timeout /t 2 >nul

:: 启动前端
echo [5/5] 启动前端 (port 5173)...
cd /d "%~dp0frontend"
start "TrainingSystem Frontend" cmd /k "npm run dev"

echo.
echo ============================================
echo  启动完成！
echo  前端: http://localhost:5173
echo  后端: http://localhost:8000
echo  API文档: http://localhost:8000/docs
echo  账号: admin / Admin@123
echo ============================================
pause
