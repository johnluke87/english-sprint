@echo off
rem Compila English Sprint e lo carica su www.gianlucadario.com/apps/english-sprint (chiede conferma; -Subito per non chiederla)
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\carica.ps1" %*
pause
