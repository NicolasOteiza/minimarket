param(
  [Parameter(Mandatory = $true)][pscustomobject]$Config
)

. "$PSScriptRoot\common.ps1"

Write-Step "Verificando servicio Node"
$svc = Get-Service -Name $Config.nodeServiceName -ErrorAction SilentlyContinue
if (-not $svc) { throw "No existe el servicio Node $($Config.nodeServiceName)." }
if ($svc.Status -ne "Running") { throw "El servicio Node no esta corriendo." }

Write-Step "Verificando frontend local"
$frontendUrl = "http://localhost/minimarket/index.php"
try {
  $front = Invoke-WebRequest -Uri $frontendUrl -UseBasicParsing -TimeoutSec 20
  if ($front.StatusCode -lt 200 -or $front.StatusCode -ge 400) {
    throw "Frontend devolvio estado no valido: $($front.StatusCode)"
  }
} catch {
  throw "No se pudo abrir frontend en $frontendUrl"
}

Write-Step "Verificando API"
$apiUrl = "http://localhost:$($Config.nodePort)/api/getInfo"
try {
  $api = Invoke-WebRequest -Uri $apiUrl -UseBasicParsing -TimeoutSec 20
  if ($api.StatusCode -ne 200) {
    throw "API devolvio estado no valido: $($api.StatusCode)"
  }
} catch {
  throw "No se pudo validar API en $apiUrl"
}

Write-Host ""
Write-Host "Instalacion validada correctamente." -ForegroundColor Green

