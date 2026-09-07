@echo off
:: start.bat — Start SysTwin AI on Windows
:: Usage: double-click or run from command prompt

echo.
echo   SysTwin AI — Digital Twin OS Monitor
echo   =====================================
echo.

SET ROOT=%~dp0
SET BACKEND=%ROOT%backend
SET FRONTEND=%ROOT%frontend

:: Check Python
where python >nul 2>&1
IF ERRORLEVEL 1 (
  echo   [ERROR] Python not found. Install from https://python.org
  pause & exit /b 1
)

:: Check Node
where node >nul 2>&1
IF ERRORLEVEL 1 (
  echo   [ERROR] Node.js not found. Install from https://nodejs.org
  pause & exit /b 1
)

:: Backend venv
cd /d "%BACKEND%"
IF NOT EXIST ".venv" (
  echo   [1/4] Creating virtual environment...
  python -m venv .venv
)

echo   [2/4] Installing backend dependencies...
call .venv\Scripts\activate.bat
pip install -q -r requirements.txt

IF NOT EXIST "data\metrics.db" (
  echo   [2b]  Generating sample data...
  python ml_model\generate_sample_data.py
)

:: Frontend deps
cd /d "%FRONTEND%"
echo   [3/4] Installing frontend dependencies...
IF NOT EXIST "node_modules" npm install --silent

:: Launch
echo   [4/4] Starting servers...
echo.
echo   Backend  ^> http://localhost:8000
echo   Frontend ^> http://localhost:3000
echo.

cd /d "%BACKEND%"
call .venv\Scripts\activate.bat
start "SysTwin Backend" cmd /k "python app.py"

timeout /t 2 /nobreak >nul

cd /d "%FRONTEND%"
start "SysTwin Frontend" cmd /k "npm run dev"

echo   Both servers started in separate windows.
echo   Close those windows to stop the servers.
pause
