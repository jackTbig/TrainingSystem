@echo off
echo ============================================
echo  AI Worker 启动脚本（数据库轮询模式）
echo ============================================

cd /d "%~dp0backend"

echo 启动所有 AI Workers...
start "AI Workers" cmd /k "python run_worker.py all"

echo.
echo ============================================
echo  Workers 已在新窗口中启动！
echo  包含: 文档解析 / 课程生成 / 题目生成
echo  每 5 秒轮询一次数据库中的待处理任务
echo ============================================
pause
