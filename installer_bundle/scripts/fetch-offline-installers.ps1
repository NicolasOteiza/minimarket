param(
  [string]$OutputDir = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OutputDir)) {
  $bundleRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
  $OutputDir = Join-Path $bundleRoot "installers"
}

if (-not (Test-Path $OutputDir)) {
  New-Item -Path $OutputDir -ItemType Directory | Out-Null
}

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Get-LatestNodeLtsMsiUrl {
  $index = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" -TimeoutSec 60
  $lts = $index | Where-Object { $_.lts -and $_.files -contains "win-x64-msi" } | Select-Object -First 1
  if (-not $lts) {
    throw "No se encontro una version LTS de Node con MSI win-x64."
  }
  $version = $lts.version
  return "https://nodejs.org/dist/$version/node-$version-x64.msi"
}

function Download-NodeInstaller {
  param([string]$OutputDir)
  Write-Step "Descargando Node.js LTS (MSI) mas reciente"
  $url = Get-LatestNodeLtsMsiUrl
  $file = Join-Path $OutputDir "node-lts.msi"
  Invoke-WebRequest -Uri $url -OutFile $file -TimeoutSec 180
  Write-Host "Node guardado en: $file" -ForegroundColor Green
}

function Download-XamppInstallerFromWinget {
  param([string]$OutputDir)
  Write-Step "Descargando XAMPP mas reciente desde winget"
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw "winget no esta disponible."
  }

  $wingetHelp = (& winget --help | Out-String)
  if ($wingetHelp -notmatch "(?im)^\s*download\s+") {
    throw "Esta version de winget no soporta 'winget download'."
  }

  $candidateIds = @(
    "ApacheFriends.Xampp.8.2",
    "ApacheFriends.Xampp.8.1",
    "ApacheFriends.Xampp"
  )

  foreach ($id in $candidateIds) {
    $tmpDir = Join-Path $env:TEMP ("xampp_dl_" + (Get-Date -Format "yyyyMMdd_HHmmss") + "_" + ($id -replace "[^a-zA-Z0-9]", ""))
    New-Item -Path $tmpDir -ItemType Directory | Out-Null
    try {
      & winget download --id $id -e --accept-source-agreements --accept-package-agreements --download-directory $tmpDir
      $exe = Get-ChildItem -Path $tmpDir -Recurse -Filter *.exe | Sort-Object LastWriteTime -Descending | Select-Object -First 1
      if ($exe) {
        $dest = Join-Path $OutputDir "xampp-installer.exe"
        Copy-Item -Path $exe.FullName -Destination $dest -Force
        Write-Host "XAMPP guardado en: $dest (fuente winget, id: $id)" -ForegroundColor Green
        return
      }
    } catch {
      # sigue con siguiente id
    } finally {
      if (Test-Path $tmpDir) { Remove-Item -Path $tmpDir -Recurse -Force }
    }
  }

  throw "winget no pudo descargar un instalador .exe de XAMPP."
}

function Download-XamppInstallerFromWeb {
  param([string]$OutputDir)
  Write-Step "Descargando XAMPP mas reciente desde ApacheFriends"
  $page = Invoke-WebRequest -Uri "https://www.apachefriends.org/download.html" -TimeoutSec 60
  $hrefs = @()
  if ($page.Links) {
    $hrefs += $page.Links | ForEach-Object { $_.href }
  }
  if ($page.Content) {
    $matches = [regex]::Matches($page.Content, 'https?://[^\s"''<>]*xampp-windows-x64-[^"''<>]*-installer\.exe(?:/download)?')
    foreach ($m in $matches) { $hrefs += $m.Value }
  }
  $link = $hrefs | Where-Object { $_ -match "xampp-windows-x64-.*-installer\.exe(/download)?$" } | Select-Object -First 1
  if (-not $link) {
    throw "No se encontro enlace de instalador XAMPP en ApacheFriends."
  }
  $dest = Join-Path $OutputDir "xampp-installer.exe"
  Invoke-WebRequest -Uri $link -OutFile $dest -TimeoutSec 300
  Write-Host "XAMPP guardado en: $dest (fuente web)" -ForegroundColor Green
}

Download-NodeInstaller -OutputDir $OutputDir
try {
  Download-XamppInstallerFromWinget -OutputDir $OutputDir
} catch {
  Write-Host "Fallo descarga por winget: $($_.Exception.Message)" -ForegroundColor Yellow
  Download-XamppInstallerFromWeb -OutputDir $OutputDir
}

Write-Host ""
Write-Host "Descarga de instaladores offline completada." -ForegroundColor Green
