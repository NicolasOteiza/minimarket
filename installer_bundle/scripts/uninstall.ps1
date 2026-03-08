param(
  [string]$InstallRoot = "C:\xampp\htdocs\minimarket",
  [string]$NodeServiceName = "MinimarketNode"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Yellow
}

Write-Step "Deteniendo y eliminando servicio Node"
$svc = Get-Service -Name $NodeServiceName -ErrorAction SilentlyContinue
if ($svc) {
  Stop-Service -Name $NodeServiceName -Force -ErrorAction SilentlyContinue
  sc.exe delete $NodeServiceName | Out-Null
}

Write-Step "Eliminando carpeta de aplicacion"
if (Test-Path $InstallRoot) {
  Remove-Item -Path $InstallRoot -Recurse -Force
}

Write-Host ""
Write-Host "Desinstalacion completada (XAMPP y Node no se desinstalan)." -ForegroundColor Green

