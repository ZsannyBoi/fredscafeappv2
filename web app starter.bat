@echo off

echo Starting front-end
start cmd /k "call npm run dev"

echo Starting backend
cd backend
start cmd /k "call node server.js"

echo Both servers are opened.
echo You can close this window now, or it will close automatically after a short delay.
timeout /t 5 >nul
exit
