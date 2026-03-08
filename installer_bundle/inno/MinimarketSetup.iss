; Plantilla Inno Setup (opcional)
; Requiere que exista installer_bundle\payload\minimarket-app.zip

#define MyAppName "Minimarket POS"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "SIA"
#define MyAppExeName "run-install.ps1"

[Setup]
AppId={{9F3D3DE9-9B28-4A68-B8AF-0DCA7E671001}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\MinimarketInstaller
DisableProgramGroupPage=yes
OutputDir=..\dist
OutputBaseFilename=MinimarketInstaller
Compression=lzma
SolidCompression=yes
ArchitecturesInstallIn64BitMode=x64

[Files]
Source: "..\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{autoprograms}\Minimarket Installer"; Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\run-install.ps1"""; WorkingDir: "{app}"

[Run]
Filename: "powershell.exe"; Parameters: "-ExecutionPolicy Bypass -File ""{app}\run-install.ps1"""; Flags: runhidden

