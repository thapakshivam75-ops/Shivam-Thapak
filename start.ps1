$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js 20 or later is required. Install from https://nodejs.org/ and reopen PowerShell.' }
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env'; Write-Host 'Created .env. Edit AI settings to enable AI, and set a password before LAN access.' }
npm start
