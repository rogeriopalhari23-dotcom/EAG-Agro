@echo off
rem Ponte de e-mail do EAG Compass: ponte iniciar ^| parar ^| estado ^| registro ^| conferir-caixa ^| conferir
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy\windows\ponte.ps1" %*
