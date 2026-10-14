$ErrorActionPreference = 'Stop'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host 'Install Node.js 20 or later from https://nodejs.org/'; exit 1 }
Write-Host "Node $(node --version) is ready. This project uses Node built-ins and needs no npm package install."
if (-not (Test-Path '.env')) { Copy-Item '.env.example' '.env'; Write-Host 'Created .env from .env.example.' }
