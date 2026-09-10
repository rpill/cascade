@echo off
setlocal
if not exist "public\assets\audio\sfx" (
  echo [Cascade] Run this file from the project root after extracting the patch.
  exit /b 1
)
del /q "public\assets\audio\sfx\*.wav" 2>nul
echo [Cascade] Old synthetic WAV SFX removed. Real OGG SFX are active.
endlocal
