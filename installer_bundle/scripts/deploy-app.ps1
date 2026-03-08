param(
  [Parameter(Mandatory = $true)][string]$BundleRoot,
  [Parameter(Mandatory = $true)][pscustomobject]$Config
)

. "$PSScriptRoot\common.ps1"

$zipPath = Join-Path $BundleRoot $Config.appZipRelativePath
if (-not (Test-Path $zipPath)) {
  throw "No existe payload ZIP: $zipPath"
}

$installRoot = $Config.installRoot
$targetParent = Split-Path -Path $installRoot -Parent
Ensure-Directory -Path $targetParent

Write-Step "Desplegando app en $installRoot"
if (Test-Path $installRoot) {
  $backupRoot = "$installRoot.backup_$(Get-Date -Format yyyyMMdd_HHmmss)"
  Move-Item -Path $installRoot -Destination $backupRoot -Force
  Write-Host "Respaldo creado: $backupRoot" -ForegroundColor Yellow
}

Ensure-Directory -Path $installRoot
Expand-Archive -Path $zipPath -DestinationPath $installRoot -Force

Write-Step "Validando estructura desplegada"
$required = @(
  (Join-Path $installRoot "index.php"),
  (Join-Path $installRoot "server\server.js"),
  (Join-Path $installRoot "content"),
  (Join-Path $installRoot "js")
)
foreach ($path in $required) {
  if (-not (Test-Path $path)) {
    throw "Estructura incompleta tras despliegue. Falta: $path"
  }
}

