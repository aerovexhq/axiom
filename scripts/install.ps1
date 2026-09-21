<#
.SYNOPSIS
    Axiom EDA — Universal Windows PowerShell Installer
.DESCRIPTION
    Installs Axiom EDA on Windows systems with version selection.
.PARAMETER Version
    Specific release version tag (e.g. v0.1.0, latest). Defaults to $env:AXIOM_VERSION or latest.
.PARAMETER InstallDir
    Target directory (defaults to $env:USERPROFILE\.axiom).
.PARAMETER ForceBuild
    Force building from source via cargo instead of downloading pre-built binaries.
.EXAMPLE
    irm https://axiom.aerovex.net/install.ps1 | iex
    & ([scriptblock]::Create((irm https://axiom.aerovex.net/install.ps1))) -Version v0.1.0
#>

[CmdletBinding()]
param(
    [string]$Version = $env:AXIOM_VERSION,
    [string]$InstallDir = "$env:USERPROFILE\.axiom",
    [switch]$ForceBuild = $false
)

$ErrorActionPreference = "Stop"

$Repo = "aerovexsim/axiom"
$DefaultVersion = "v0.1.0"
$BinDir = Join-Path $InstallDir "bin"

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host " Axiom EDA — Windows Installer" -ForegroundColor Cyan
Write-Host " Platform: Aerovex (https://axiom.aerovex.net)" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan

# 1. Architecture Check
$Arch = if ([Environment]::Is64BitOperatingSystem) { "x86_64" } else { "x86" }
$Target = "$Arch-windows"
Write-Host "==> Detected Platform: Windows ($Arch)" -ForegroundColor Yellow

# 2. Resolve Version
if ([string]::IsNullOrWhiteSpace($Version) -or $Version -eq "latest") {
    Write-Host "==> Checking latest release on GitHub..." -ForegroundColor Yellow
    try {
        $releaseInfo = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers @{"User-Agent"="AxiomInstaller"}
        if ($releaseInfo -and $releaseInfo.tag_name) {
            $Version = $releaseInfo.tag_name
        } else {
            $Version = $DefaultVersion
        }
    } catch {
        $Version = $DefaultVersion
    }
}

if (-not $Version.StartsWith("v")) {
    $Version = "v$Version"
}

Write-Host "==> Target Version: $Version" -ForegroundColor Green

if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
}

$TempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("axiom-install-" + [System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

$Installed = $false

# 3. Attempt Release Download
if (-not $ForceBuild) {
    $ZipName = "axiom-$Version-$Target.zip"
    $CdnUrl = "https://axiom.aerovex.net/dist/$ZipName"
    $ReleaseUrl = "https://github.com/$Repo/releases/download/$Version/$ZipName"
    Write-Host "==> Attempting download of pre-built release binary..." -ForegroundColor Cyan

    $ZipPath = Join-Path $TempDir $ZipName
    $Downloaded = $false

    try {
        Invoke-WebRequest -Uri $CdnUrl -OutFile $ZipPath -UseBasicParsing
        Write-Host "  [OK] Downloaded from Aerovex CDN." -ForegroundColor Green
        $Downloaded = $true
    } catch {
        try {
            Invoke-WebRequest -Uri $ReleaseUrl -OutFile $ZipPath -UseBasicParsing
            Write-Host "  [OK] Downloaded from GitHub Releases." -ForegroundColor Green
            $Downloaded = $true
        } catch {
            Write-Host "  [Note] Pre-built release not found on CDN or GitHub. Falling back to source build..." -ForegroundColor Yellow
        }
    }

    if ($Downloaded) {
        Expand-Archive -Path $ZipPath -DestinationPath $BinDir -Force
        $Installed = $true
    }
}

# 4. Fallback: Build from Source if prebuilt not found
if (-not $Installed) {
    if (-not (Get-Command "cargo" -ErrorAction SilentlyContinue) -or -not (Get-Command "git" -ErrorAction SilentlyContinue)) {
        Write-Error "Git and Rust (cargo) are required to build from source. Install from https://rustup.rs and https://git-scm.com"
        exit 1
    }

    Write-Host "==> Cloning repository and compiling from source..." -ForegroundColor Yellow
    $SrcDir = Join-Path $TempDir "axiom-src"
    & git clone --depth 1 "https://github.com/$Repo.git" $SrcDir
    Set-Location $SrcDir
    & cargo build --release --bin axiom --bin axiom-desktop
    
    $BuiltBin = Join-Path $SrcDir "target\release\axiom.exe"
    $BuiltDesktop = Join-Path $SrcDir "target\release\axiom-desktop.exe"
    if (-not (Test-Path $BuiltBin)) {
        Write-Error "Failed to compile axiom.exe"
        exit 1
    }

    Copy-Item -Path $BuiltBin -Destination (Join-Path $BinDir "axiom.exe") -Force
    if (Test-Path $BuiltDesktop) {
        Copy-Item -Path $BuiltDesktop -Destination (Join-Path $BinDir "axiom-desktop.exe") -Force
    }
    Copy-Item -Path $BuiltBin -Destination (Join-Path $BinDir "betterado.exe") -Force
    $Installed = $true
}

# Cleanup Temp
Remove-Item -Path $TempDir -Recurse -Force -ErrorAction SilentlyContinue

# 5. Add to User PATH
$UserPath = [Environment]::GetEnvironmentVariable("PATH", "User")
$PathAdded = $false
if ($UserPath -notlike "*$BinDir*") {
    $NewPath = if ([string]::IsNullOrWhiteSpace($UserPath)) { $BinDir } else { "$UserPath;$BinDir" }
    [Environment]::SetEnvironmentVariable("PATH", $NewPath, "User")
    $env:PATH = "$env:PATH;$BinDir"
    $PathAdded = $true
}

# 6. Icon & Desktop Application Shortcuts (Windows Start Menu & Desktop)
Write-Host "==> Configuring desktop application integration..." -ForegroundColor Cyan
$IconUrl = "https://axiom.aerovex.net/axiom.ico"
$IconPath = Join-Path $InstallDir "axiom.ico"

try {
    Invoke-WebRequest -Uri $IconUrl -OutFile $IconPath -UseBasicParsing
    Write-Host "  [OK] Downloaded official icon: $IconPath" -ForegroundColor Green
} catch {
    Write-Host "  [Note] Could not download icon file." -ForegroundColor Yellow
}

try {
    $WshShell = New-Object -ComObject WScript.Shell

    # Start Menu Shortcut (Indexed by Windows Search)
    $StartMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs"
    if (Test-Path $StartMenuDir) {
        $StartShortcutPath = Join-Path $StartMenuDir "Axiom EDA.lnk"
        $DesktopExe = Join-Path $BinDir "axiom-desktop.exe"
        $TargetExe = if (Test-Path $DesktopExe) { $DesktopExe } else { (Join-Path $BinDir "axiom.exe") }
        $Shortcut = $WshShell.CreateShortcut($StartShortcutPath)
        $Shortcut.TargetPath = $TargetExe
        $Shortcut.Arguments = ""
        $Shortcut.WorkingDirectory = "$InstallDir"
        $Shortcut.Description = "Axiom EDA — High-Performance HDL Simulator & Silicon Telemetry"
        if (Test-Path $IconPath) {
            $Shortcut.IconLocation = "$IconPath, 0"
        }
        $Shortcut.Save()
        Write-Host "  [OK] Created Start Menu Shortcut: $StartShortcutPath" -ForegroundColor Green
        Write-Host "       (Search 'Axiom' in Windows Start Menu to launch native desktop studio)" -ForegroundColor DarkGray
    }

    # Desktop Shortcut
    $DesktopDir = [Environment]::GetFolderPath("Desktop")
    if (Test-Path $DesktopDir) {
        $DesktopShortcutPath = Join-Path $DesktopDir "Axiom EDA.lnk"
        $DesktopExe = Join-Path $BinDir "axiom-desktop.exe"
        $TargetExe = if (Test-Path $DesktopExe) { $DesktopExe } else { (Join-Path $BinDir "axiom.exe") }
        $DesktopShortcut = $WshShell.CreateShortcut($DesktopShortcutPath)
        $DesktopShortcut.TargetPath = $TargetExe
        $DesktopShortcut.Arguments = ""
        $DesktopShortcut.WorkingDirectory = "$InstallDir"
        $DesktopShortcut.Description = "Axiom EDA — High-Performance HDL Simulator & Silicon Telemetry"
        if (Test-Path $IconPath) {
            $DesktopShortcut.IconLocation = "$IconPath, 0"
        }
        $DesktopShortcut.Save()
        Write-Host "  [OK] Created Desktop Shortcut: $DesktopShortcutPath" -ForegroundColor Green
    }
} catch {
    Write-Host "  [Note] Skipping desktop shortcut creation: $_" -ForegroundColor Yellow
}

Write-Host "================================================================================" -ForegroundColor Green
Write-Host " Axiom EDA ($Version) successfully installed!" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green

Write-Host "Binary:  $(Join-Path $BinDir 'axiom.exe')" -ForegroundColor White
if (Test-Path (Join-Path $BinDir "axiom.exe")) {
    $ver = (& (Join-Path $BinDir "axiom.exe") --version)
    Write-Host "Version: $ver" -ForegroundColor White
}

if ($PathAdded) {
    Write-Host ""
    Write-Host "[OK] Added $BinDir to User PATH." -ForegroundColor Green
    Write-Host "Restart your terminal or PowerShell window to use the 'axiom' command." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Get started with:" -ForegroundColor Gray
Write-Host "  axiom compile tests\fixtures\alu.v -t alu" -ForegroundColor Cyan
Write-Host "  axiom run tests\fixtures\counter.v -t counter --ticks 100 --vcd wave.vcd" -ForegroundColor Cyan
Write-Host "  axiom --help" -ForegroundColor Cyan
Write-Host ""
Write-Host "Documentation: https://axiom.aerovex.net" -ForegroundColor White
