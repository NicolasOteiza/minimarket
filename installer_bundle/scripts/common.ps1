Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Assert-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Debe ejecutar este script como Administrador."
  }
}

function Read-Config {
  param([string]$BundleRoot)
  $configPath = Join-Path $BundleRoot "config\install.config.json"
  if (-not (Test-Path $configPath)) {
    throw "No existe config: $configPath"
  }
  return (Get-Content $configPath -Raw | ConvertFrom-Json)
}

function Ensure-Directory {
  param([string]$Path)
  if (-not (Test-Path $Path)) {
    New-Item -Path $Path -ItemType Directory | Out-Null
  }
}

function Find-XamppMysqlExe {
  param([string]$XamppRoot)
  $candidate = Join-Path $XamppRoot "mysql\bin\mysql.exe"
  if (Test-Path $candidate) { return $candidate }
  return $null
}

function Find-XamppApacheService {
  $services = Get-Service | Where-Object { $_.Name -match "Apache|xamppapache" -or $_.DisplayName -match "Apache" }
  return $services | Select-Object -First 1
}

function Find-XamppMysqlService {
  $services = Get-Service | Where-Object { $_.Name -match "mysql|xamppmysql" -or $_.DisplayName -match "MySQL|MariaDB" }
  return $services | Select-Object -First 1
}

