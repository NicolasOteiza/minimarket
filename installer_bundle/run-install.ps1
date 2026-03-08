Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$bundleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

. "$bundleRoot\scripts\common.ps1"
Assert-Admin

$config = Read-Config -BundleRoot $bundleRoot

Write-Step "Instalacion automatica Minimarket - inicio"

& "$bundleRoot\scripts\install-prereqs.ps1" -Config $config
& "$bundleRoot\scripts\deploy-app.ps1" -BundleRoot $bundleRoot -Config $config
& "$bundleRoot\scripts\setup-database.ps1" -Config $config
& "$bundleRoot\scripts\setup-services.ps1" -Config $config
& "$bundleRoot\scripts\verify-install.ps1" -Config $config

Write-Host ""
Write-Host "Instalacion finalizada." -ForegroundColor Green
Write-Host "Abrir sistema: http://localhost/minimarket/index.php" -ForegroundColor Green

