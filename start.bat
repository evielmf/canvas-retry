@echo off
echo 🎓 Canvas API Integration System
echo ================================

echo.
echo Starting FastAPI Backend...
cd backend
start "Canvas API Backend" python start.py

echo.
echo Waiting for backend to start...
timeout /t 5 /nobreak > nul

echo.
echo Starting Next.js Frontend...
cd ..\web-app
start "Canvas Frontend" npm run dev

echo.
echo 🚀 System Started!
echo.
echo Services:
echo - Backend API: http://localhost:8000
echo - Frontend: http://localhost:3000
echo - API Docs: http://localhost:8000/docs
echo.
echo Press any key to stop all services...
pause > nul

echo.
echo Stopping services...
taskkill /f /im python.exe /t 2>nul
taskkill /f /im node.exe /t 2>nul
echo Services stopped.
pause
