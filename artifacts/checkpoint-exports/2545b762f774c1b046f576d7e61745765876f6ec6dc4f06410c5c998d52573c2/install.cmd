@echo off
setlocal
set "ELECTRON_RUN_AS_NODE="
start "" "%~dp0runtime\electron\electron.exe" "%~dp0runtime\install-gui.cjs" "%~dp0."
