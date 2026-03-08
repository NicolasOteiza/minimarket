param(
  [Parameter(Mandatory = $true)][pscustomobject]$Config
)

. "$PSScriptRoot\common.ps1"

$installRoot = $Config.installRoot
$serverRoot = Join-Path $installRoot "server"
$nodeExe = $Config.nodeExePath
$nodeService = $Config.nodeServiceName
$serverScript = Join-Path $serverRoot "server.js"

if (-not (Test-Path $nodeExe)) {
  $nodeFromPath = (Get-Command node -ErrorAction SilentlyContinue).Source
  if ($nodeFromPath) {
    $nodeExe = $nodeFromPath
  } else {
    throw "No se encontro Node ejecutable."
  }
}

Write-Step "Instalando dependencias Node del backend"
Push-Location $serverRoot
try {
  npm install
} finally {
  Pop-Location
}

Write-Step "Configurando servicio Node ($nodeService)"
$existingService = Get-Service -Name $nodeService -ErrorAction SilentlyContinue
if ($existingService) {
  Stop-Service -Name $nodeService -Force -ErrorAction SilentlyContinue
  sc.exe delete $nodeService | Out-Null
  Start-Sleep -Seconds 1
}

$binPath = "`"$nodeExe`" `"$serverScript`""
sc.exe create $nodeService binPath= $binPath start= auto DisplayName= "Minimarket Backend API" | Out-Null
sc.exe description $nodeService "Servicio Node.js del sistema Minimarket" | Out-Null

Start-Service -Name $nodeService

Write-Step "Configurando Apache/MySQL en inicio automatico"
if ($Config.startXamppServicesAutomatically) {
  $apacheSvc = Find-XamppApacheService
  $mysqlSvc = Find-XamppMysqlService

  if ($apacheSvc) {
    Set-Service -Name $apacheSvc.Name -StartupType Automatic
    if ($apacheSvc.Status -ne "Running") { Start-Service -Name $apacheSvc.Name }
  }
  if ($mysqlSvc) {
    Set-Service -Name $mysqlSvc.Name -StartupType Automatic
    if ($mysqlSvc.Status -ne "Running") { Start-Service -Name $mysqlSvc.Name }
  }
}

