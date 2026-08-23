@echo off
setlocal
cd /d "%~dp0docs"
start "WS Server (docs)" cmd /k python -m http.server 8080
timeout /t 1 /nobreak >nul
start "" http://localhost:8080/
endlocal
