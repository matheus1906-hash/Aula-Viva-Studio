; Instalador Windows (Inno Setup 6): iscc packaging\installer.iss
#define AppName "AulaViva Studio"
#define AppVersion "2.1.0"

[Setup]
AppId={{6C1E2B5A-8F0D-4B7E-9A51-3F2D7C9E0A11}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher=AulaViva
DefaultDirName={autopf}\AulaViva Studio
DefaultGroupName={#AppName}
OutputDir=..\dist
OutputBaseFilename=AulaVivaStudio-Setup-{#AppVersion}
SetupIconFile=..\aulaviva\assets\icon.ico
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
ArchitecturesInstallIn64BitMode=x64compatible

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "desktopicon"; Description: "Criar atalho na área de trabalho"; GroupDescription: "Atalhos:"

[Files]
Source: "..\dist\AulaVivaStudio\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion

[Icons]
Name: "{group}\{#AppName}"; Filename: "{app}\AulaVivaStudio.exe"
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\AulaVivaStudio.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\AulaVivaStudio.exe"; Description: "Abrir o {#AppName}"; Flags: nowait postinstall skipifsilent
