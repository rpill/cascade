@echo off
setlocal EnableExtensions

set "PATCH_DIR=%~dp0"
for %%I in ("%PATCH_DIR%..") do set "ROOT=%%~fI"
set "PATCH=%PATCH_DIR%cascade-d1-migration.patch"

if not exist "%ROOT%\package.json" (
  echo ERROR: Put the cascade-d1-patch folder directly inside the Cascade project root.
  echo Expected: %ROOT%\package.json
  exit /b 1
)

if not exist "%ROOT%\wrangler.jsonc" (
  echo ERROR: wrangler.jsonc was not found in the Cascade project root.
  exit /b 1
)

where git >nul 2>nul
if errorlevel 1 (
  echo ERROR: git is not available in PATH.
  exit /b 1
)

if not exist "%PATCH%" (
  echo ERROR: Patch file not found: %PATCH%
  exit /b 1
)

echo Checking patch...
git -C "%ROOT%" apply --check "%PATCH%"
if errorlevel 1 (
  echo.
  echo ERROR: Patch check failed. Nothing was changed.
  echo Send the error output back to ChatGPT; do not force-apply it.
  exit /b 1
)

echo Applying Cloudflare D1 migration...
git -C "%ROOT%" apply --whitespace=nowarn "%PATCH%"
if errorlevel 1 (
  echo ERROR: git apply failed unexpectedly.
  exit /b 1
)

echo.
echo Patch applied successfully.
echo Existing untracked/local secret files were not read, deleted, or modified by this script.
echo Next: run pnpm test
exit /b 0
