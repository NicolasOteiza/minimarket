param(
  [Parameter(Mandatory = $true)][pscustomobject]$Config
)

. "$PSScriptRoot\common.ps1"

Write-Step "Iniciando MySQL para preparar base de datos"
$mysqlSvc = Find-XamppMysqlService
if ($mysqlSvc) {
  if ($mysqlSvc.Status -ne "Running") {
    Start-Service -Name $mysqlSvc.Name
  }
  Set-Service -Name $mysqlSvc.Name -StartupType Automatic
} else {
  Write-Host "No se detecto servicio MySQL. Intentando iniciar stack XAMPP..." -ForegroundColor Yellow
  $xamppStart = Join-Path $Config.xamppRoot "xampp_start.exe"
  if (Test-Path $xamppStart) {
    & $xamppStart | Out-Null
    Start-Sleep -Seconds 5
  }
}

$mysqlExe = Find-XamppMysqlExe -XamppRoot $Config.xamppRoot
if (-not $mysqlExe) {
  throw "No se encontro mysql.exe en XAMPP."
}

Write-Step "Creando base de datos $($Config.dbName)"
$dbNameEscaped = ($Config.dbName -replace "[^a-zA-Z0-9_]", "")
if ([string]::IsNullOrWhiteSpace($dbNameEscaped)) {
  throw "Nombre de base de datos invalido."
}
$createSql = "CREATE DATABASE IF NOT EXISTS $dbNameEscaped CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

if ([string]::IsNullOrWhiteSpace($Config.dbPassword)) {
  & $mysqlExe -u $Config.dbUser -e $createSql
} else {
  & $mysqlExe -u $Config.dbUser -p$($Config.dbPassword) -e $createSql
}
