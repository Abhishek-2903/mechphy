@echo off
echo Starting Sci-Fi Simulator...
echo.

REM Method 1: Simple timeout approach (most reliable)
echo Starting development server...
start /b npm run dev

echo Waiting for server to start (15 seconds)...
for /l %%i in (15,-1,1) do (
    echo Waiting... %%i seconds remaining
    timeout /t 1 /nobreak >nul 2>&1
)

echo Opening browser...
start "" "http://localhost:3000"
echo.
echo ========================================
echo  Sci-Fi Simulator should now be running!
echo  If browser didn't open, go to:
echo  http://localhost:3000
echo ========================================
echo.
echo Press any key to close this window
pause >nul
exit