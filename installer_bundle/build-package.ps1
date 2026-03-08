Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$bundleRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $bundleRoot
$payloadDir = Join-Path $bundleRoot "payload"
$payloadZip = Join-Path $payloadDir "minimarket-app.zip"
$tempCopy = Join-Path $env:TEMP "minimarket_pack_$(Get-Date -Format yyyyMMdd_HHmmss)"

Write-Host "Generando payload de aplicacion..." -ForegroundColor Cyan

if (Test-Path $tempCopy) { Remove-Item $tempCopy -Recurse -Force }
New-Item -Path $tempCopy -ItemType Directory | Out-Null
if (-not (Test-Path $payloadDir)) { New-Item -Path $payloadDir -ItemType Directory | Out-Null }

$exclude = @(
  ".git",
  ".vscode",
  "installer_bundle"
)

Get-ChildItem -Path $projectRoot -Force | ForEach-Object {
  if ($exclude -contains $_.Name) { return }
  Copy-Item -Path $_.FullName -Destination $tempCopy -Recurse -Force
}

if (Test-Path $payloadZip) { Remove-Item $payloadZip -Force }
Compress-Archive -Path (Join-Path $tempCopy "*") -DestinationPath $payloadZip -CompressionLevel Optimal

Remove-Item $tempCopy -Recurse -Force

Write-Host "Payload creado: $payloadZip" -ForegroundColor Green

