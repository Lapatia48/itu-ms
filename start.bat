@echo off
setlocal
title ITU Motor Society - Launcher

set RACINE=%~dp0
if %RACINE:~-1%==\ set RACINE=%RACINE:~0,-1%

REM Chaque service n'est lance que s'il n'ecoute pas deja sur son port. Sans ce
REM controle, un second lancement fait echouer le service qui arrive en second
REM sur « une seule utilisation de chaque adresse de socket » : le premier
REM tourne toujours, le nouveau meurt, et la fenetre se ferme sans qu'on sache
REM lequel des deux etait le bon.

call :lancer "Backend"     4000 "cd /d %RACINE%\backend && npm run dev"
call :lancer "Boutique"    5173 "cd /d %RACINE%\frontoffice && npm run dev"
call :lancer "Console"     5174 "cd /d %RACINE%\backoffice && npm run dev"

echo.
echo   API       http://127.0.0.1:4000/api/v1
echo   Boutique  http://127.0.0.1:5173
echo   Console   http://127.0.0.1:5174
echo.
exit /b

REM --- :lancer ^<titre^> ^<port^> ^<commande^> ------------------------------
:lancer
netstat -ano | findstr /c:"LISTENING" | findstr /c:":%~2 " >nul
if not errorlevel 1 (
  echo [deja en service] %~1 ecoute sur le port %~2, rien a relancer.
  exit /b
)
echo [demarrage]       %~1 sur le port %~2
start "%~1" cmd /k %3
exit /b
