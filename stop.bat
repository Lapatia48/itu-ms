@echo off
setlocal
title ITU Motor Society - Arret

REM Pendant de start.bat : on arrete chaque service par le PORT sur lequel il
REM ecoute, et non par nom d'image. Tuer tous les node.exe du poste emporterait
REM aussi ce qui n'a rien a voir avec le projet.
REM
REM Deux processus par service : la fenetre cmd ouverte par start.bat, qui garde
REM la main avec /k, et le node.exe qu'elle a lance â€” avec Â« node --watch Â», node
REM se dedouble meme. Le PID qui ecoute est celui de node ; /T emporte sa
REM descendance, puis la fenetre restee vide est fermee par son titre.
REM
REM Le corps des boucles est sorti en sous-routines (call :abattre) : un bloc
REM entre parentheses qui contient un REM et de l'expansion differee ne
REM s'execute pas comme il se lit.

set ARRETES=0

call :tuer "Backend"  4000
call :tuer "Boutique" 5173
call :tuer "Console"  5174

REM Une fenetre dont le service etait deja arrete n'ecoute sur rien : elle n'a
REM pas de port, donc les boucles ci-dessus ne l'ont pas vue. On la ferme ici.
call :fermer "Backend"
call :fermer "Boutique"
call :fermer "Console"

echo.
if "%ARRETES%"=="0" (
  echo   Aucun service du projet n'etait en cours.
) else (
  echo   %ARRETES% service^(s^) arrete^(s^). Ports 4000, 5173 et 5174 liberes.
)
echo.
exit /b


REM --- :tuer ^<titre^> ^<port^> --------------------------------------------
:tuer
set TROUVE=
for /f "tokens=5" %%p in ('netstat -ano ^| findstr /c:"LISTENING" ^| findstr /c:":%~2 "') do call :abattre %~1 %~2 %%p
if not defined TROUVE echo [rien a faire]    %~1 n'ecoutait pas sur le port %~2.
exit /b


REM --- :abattre ^<titre^> ^<port^> ^<pid^> ---------------------------------
:abattre
REM Le meme service ecoute souvent en IPv4 et en IPv6 : son PID sort deux fois.
REM Au second passage il est deja mort â€” on le constate et on se tait, plutot
REM que d'annoncer un echec qui n'en est pas un.
tasklist /FI "PID eq %~3" /NH | findstr /c:"%~3" >nul
if errorlevel 1 exit /b

taskkill /PID %~3 /T /F >nul 2>&1
if errorlevel 1 (
  echo [echec]           %~1 ^(port %~2, PID %~3^) : droits insuffisants ?
) else (
  echo [arrete]          %~1 ^(port %~2, PID %~3^)
  set /a ARRETES+=1
)
set TROUVE=1
exit /b


REM --- :fermer ^<titre^> ---------------------------------------------------
:fermer
taskkill /F /FI "WINDOWTITLE eq %~1*" /IM cmd.exe >nul 2>&1
exit /b
