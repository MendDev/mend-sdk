@echo off
npm run lint
if errorlevel 1 exit /b 1
npm run format -- --check
if errorlevel 1 exit /b 1
npm run typecheck
if errorlevel 1 exit /b 1
