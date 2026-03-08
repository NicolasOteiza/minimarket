Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$bundleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$issPath = Join-Path $bundleRoot "inno\MinimarketSetup.iss"

if (-not (Test-Path $issPath)) {
  throw "No existe archivo Inno Setup: $issPath"
}

$iscc = Get-Command ISCC.exe -ErrorAction SilentlyContinue
if (-not $iscc) {
  throw "ISCC.exe no encontrado. Instale Inno Setup y vuelva a ejecutar."
}

& $iscc.Source $issPath
Write-Host "Compilacion finalizada. Revise installer_bundle\\dist" -ForegroundColor Green

