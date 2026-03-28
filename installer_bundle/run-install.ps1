Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$bundleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

. "$bundleRoot\scripts\common.ps1"
Assert-Admin

$config = Read-Config -BundleRoot $bundleRoot
$logDir = Join-Path $bundleRoot $config.logDir
Ensure-Directory -Path $logDir
$logFile = Join-Path $logDir ("install_" + (Get-Date -Format "yyyyMMdd_HHmmss") + ".log")

Start-Transcript -Path $logFile -Force | Out-Null
try {
  Write-Step "Instalacion automatica Minimarket - inicio"

  & "$bundleRoot\scripts\install-prereqs.ps1" -BundleRoot $bundleRoot -Config $config
  & "$bundleRoot\scripts\deploy-app.ps1" -BundleRoot $bundleRoot -Config $config
  & "$bundleRoot\scripts\setup-database.ps1" -Config $config
  & "$bundleRoot\scripts\setup-services.ps1" -Config $config
  & "$bundleRoot\scripts\verify-install.ps1" -Config $config

  Write-Host ""
  Write-Host "Instalacion finalizada." -ForegroundColor Green
  Write-Host "Abrir sistema: http://localhost/minimarket/index.php" -ForegroundColor Green
} catch {
  Write-Host ""
  Write-Host "Instalacion fallida: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "Revise log: $logFile" -ForegroundColor Yellow
  throw
} finally {
  Stop-Transcript | Out-Null
}
