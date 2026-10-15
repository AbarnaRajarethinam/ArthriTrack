$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath (Join-Path $PSScriptRoot 'backend')
& (Join-Path $PSScriptRoot '.venv\Scripts\python.exe') -m alembic upgrade head
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& (Join-Path $PSScriptRoot '.venv\Scripts\python.exe') -m uvicorn app:app --host 127.0.0.1 --port 8000
