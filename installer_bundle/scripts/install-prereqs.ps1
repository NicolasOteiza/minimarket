param(
  [Parameter(Mandatory = $true)][pscustomobject]$Config
)

. "$PSScriptRoot\common.ps1"

Write-Step "Validando winget"
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  throw "winget no esta disponible. Instale App Installer desde Microsoft Store."
}

Write-Step "Instalando Node.js LTS"
try {
  winget install OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
} catch {
  Write-Host "Node.js LTS ya podria estar instalado. Continuando..." -ForegroundColor Yellow
}

Write-Step "Instalando XAMPP"
try {
  winget install ApacheFriends.Xampp.8.2 --silent --accept-source-agreements --accept-package-agreements
} catch {
  try {
    winget install ApacheFriends.Xampp --silent --accept-source-agreements --accept-package-agreements
  } catch {
    Write-Host "No se pudo instalar XAMPP por winget. Revise paquete disponible y reintente." -ForegroundColor Yellow
    throw
  }
}

Write-Step "Verificando binarios"
$nodeCheck = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCheck) {
  throw "Node no quedo disponible en PATH tras instalacion."
}
if (-not (Test-Path $Config.xamppRoot)) {
  throw "No se encontro XAMPP en $($Config.xamppRoot)."
}

