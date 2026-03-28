param(
  [Parameter(Mandatory = $true)][string]$BundleRoot,
  [Parameter(Mandatory = $true)][pscustomobject]$Config
)

. "$PSScriptRoot\common.ps1"

function Install-NodeLocal {
  param([string]$BundleRoot, [pscustomobject]$Config)
  $nodeInstaller = Join-Path $BundleRoot $Config.localNodeInstallerPath
  if (-not (Test-Path $nodeInstaller)) {
    throw "No hay instalador local de Node en $nodeInstaller"
  }
  Write-Step "Instalando Node.js desde instalador local"
  $args = $Config.localNodeInstallerArgs
  if ([string]::IsNullOrWhiteSpace($args)) { $args = "/qn /norestart" }
  Start-Process -FilePath $nodeInstaller -ArgumentList $args -Wait -NoNewWindow
}

function Install-XamppLocal {
  param([string]$BundleRoot, [pscustomobject]$Config)
  $xamppInstaller = Join-Path $BundleRoot $Config.localXamppInstallerPath
  if (-not (Test-Path $xamppInstaller)) {
    throw "No hay instalador local de XAMPP en $xamppInstaller"
  }
  Write-Step "Instalando XAMPP desde instalador local"
  $args = $Config.localXamppInstallerArgs
  if ([string]::IsNullOrWhiteSpace($args)) { $args = "/S" }
  Start-Process -FilePath $xamppInstaller -ArgumentList $args -Wait -NoNewWindow
}

function Has-Node {
  if (Get-Command node -ErrorAction SilentlyContinue) { return $true }
  if (Test-Path $Config.nodeExePath) { return $true }
  return $false
}

function Has-Xampp {
  if (Test-Path $Config.xamppRoot) { return $true }
  return $false
}

if (Has-Node) {
  Write-Step "Node.js ya instalado. Omitiendo instalacion."
} else {
  Write-Step "Instalando Node.js LTS"
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    try {
      winget install OpenJS.NodeJS.LTS --silent --accept-source-agreements --accept-package-agreements
    } catch {
      Write-Host "Fallo instalacion de Node por winget. Se intentara instalador local." -ForegroundColor Yellow
      Install-NodeLocal -BundleRoot $BundleRoot -Config $Config
    }
  } else {
    Write-Host "winget no disponible. Se intentara instalador local de Node." -ForegroundColor Yellow
    Install-NodeLocal -BundleRoot $BundleRoot -Config $Config
  }
}

if (Has-Xampp) {
  Write-Step "XAMPP ya instalado. Omitiendo instalacion."
} else {
  Write-Step "Instalando XAMPP"
  if (Get-Command winget -ErrorAction SilentlyContinue) {
    try {
      winget install ApacheFriends.Xampp.8.2 --silent --accept-source-agreements --accept-package-agreements
    } catch {
      try {
        winget install ApacheFriends.Xampp --silent --accept-source-agreements --accept-package-agreements
      } catch {
        Write-Host "Fallo instalacion de XAMPP por winget. Se intentara instalador local." -ForegroundColor Yellow
        Install-XamppLocal -BundleRoot $BundleRoot -Config $Config
      }
    }
  } else {
    Write-Host "winget no disponible. Se intentara instalador local de XAMPP." -ForegroundColor Yellow
    Install-XamppLocal -BundleRoot $BundleRoot -Config $Config
  }
}

Write-Step "Refrescando PATH de sesion"
$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($machinePath -and $userPath) {
  $env:Path = "$machinePath;$userPath"
} elseif ($machinePath) {
  $env:Path = $machinePath
}

Write-Step "Verificando prerequisitos"
if (-not (Has-Node)) {
  throw "Node no quedo instalado correctamente."
}
if (-not (Has-Xampp)) {
  throw "XAMPP no quedo instalado correctamente en $($Config.xamppRoot)."
}

