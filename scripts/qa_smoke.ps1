$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

Write-Output "== QA Smoke =="
Write-Output ("Fecha: " + (Get-Date).ToString("yyyy-MM-dd HH:mm:ss"))

$phpFiles = @(
  'index.php',
  'home.php',
  'content/ventas.php',
  'content/productos.php',
  'content/inventario.php',
  'content/compras.php',
  'content/corte.php',
  'content/reportes.php'
)

$jsFiles = @(
  'js/scripts.js',
  'js/login.js',
  'js/functions.js',
  'server/server.js'
)

Write-Output ""
Write-Output "-- PHP Lint --"
foreach ($file in $phpFiles) {
  & 'C:\xampp\php\php.exe' -l $file
}

Write-Output ""
Write-Output "-- Node Check --"
foreach ($file in $jsFiles) {
  node --check $file
  Write-Output ("OK " + $file)
}

Write-Output ""
Write-Output "-- API Health --"
try {
  $r = Invoke-WebRequest -Uri 'http://localhost:3001/api/getInfo' -UseBasicParsing -TimeoutSec 8
  Write-Output ("STATUS " + [int]$r.StatusCode)
  $previewLen = [Math]::Min(300, $r.Content.Length)
  Write-Output ($r.Content.Substring(0, $previewLen))
} catch {
  Write-Output ("ERROR " + $_.Exception.Message)
  exit 1
}

Write-Output ""
Write-Output "QA Smoke finalizado."
