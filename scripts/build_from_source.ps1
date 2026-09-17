<#
.SYNOPSIS
    Axiom EDA — Windows PowerShell Build from Source Script
.DESCRIPTION
    Compiles the in-RAM Cranelift JIT engine and CLI driver on Windows.
.PARAMETER Prefix
    Target installation directory (defaults to $env:USERPROFILE\.axiom).
.PARAMETER CliOnly
    Only build the Rust CLI driver (skip Node/UI build).
.PARAMETER Debug
    Build with debug profile instead of release.
.PARAMETER SkipTests
    Skip running cargo tests before installation.
.EXAMPLE
    .\scripts\build_from_source.ps1
    .\scripts\build_from_source.ps1 -Prefix "C:\Tools\Axiom" -CliOnly
#>

[CmdletBinding()]
param(
    [string]$Prefix = "$env:USERPROFILE\.axiom",
    [switch]$CliOnly = $false,
    [switch]$Debug = $false,
    [switch]$SkipTests = $false
)

$ErrorActionPreference = "Stop"

Write-Host "================================================================================" -ForegroundColor Cyan
Write-Host " Axiom EDA — Windows Build from Source Driver" -ForegroundColor Cyan
Write-Host "================================================================================" -ForegroundColor Cyan

# 1. Check Rust Toolchain
Write-Host "==> Checking system dependencies..." -ForegroundColor Yellow

if (-not (Get-Command "cargo" -ErrorAction SilentlyContinue) -or -not (Get-Command "rustc" -ErrorAction SilentlyContinue)) {
    Write-Error "Rust toolchain (cargo/rustc) is not found in PATH. Install from https://rustup.rs"
    exit 1
}

$rustVersion = (& rustc --version)
Write-Host "  [OK] Rust toolchain: $rustVersion" -ForegroundColor Green

if (-not $CliOnly) {
    if (-not (Get-Command "node" -ErrorAction SilentlyContinue) -or -not (Get-Command "npm" -ErrorAction SilentlyContinue)) {
        Write-Warning "Node.js/npm not found. Defaulting to CLI-only mode."
        $CliOnly = $true
    } else {
        $nodeVersion = (& node -v)
        Write-Host "  [OK] Node.js found: $nodeVersion" -ForegroundColor Green
    }
}

# 2. Run Tests if requested
$RepoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $RepoRoot

if (-not $SkipTests) {
    Write-Host "==> Running workspace test suite..." -ForegroundColor Yellow
    & cargo test --workspace
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Workspace tests failed."
        exit 1
    }
    Write-Host "  [OK] All tests passed!" -ForegroundColor Green
}

# 3. Build Rust Binaries
$BuildProfile = if ($Debug) { "debug" } else { "release" }
Write-Host "==> Compiling Axiom CLI binary ($BuildProfile)..." -ForegroundColor Yellow

$cargoArgs = @("build", "-p", "betterado-cli", "--bin", "axiom")
if (-not $Debug) {
    $cargoArgs += "--release"
}

& cargo @cargoArgs
if ($LASTEXITCODE -ne 0) {
    Write-Error "Cargo build failed."
    exit 1
}

$TargetBin = Join-Path $RepoRoot "target\$BuildProfile\axiom.exe"
if (-not (Test-Path $TargetBin)) {
    Write-Error "Compiled binary not found at $TargetBin"
    exit 1
}
Write-Host "  [OK] Binary compiled: $TargetBin" -ForegroundColor Green

# 4. Build UI if requested
if (-not $CliOnly) {
    Write-Host "==> Building modern Web/Desktop UI bundle..." -ForegroundColor Yellow
    Set-Location (Join-Path $RepoRoot "ui")
    & npm install --silent
    & npm run build
    Set-Location $RepoRoot
    Write-Host "  [OK] UI bundle built successfully!" -ForegroundColor Green
}

# 5. Install to Prefix
$BinDir = Join-Path $Prefix "bin"
if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
}

Copy-Item -Path $TargetBin -Destination (Join-Path $BinDir "axiom.exe") -Force
# Copy alias betterado.exe as well
Copy-Item -Path $TargetBin -Destination (Join-Path $BinDir "betterado.exe") -Force

Write-Host "================================================================================" -ForegroundColor Green
Write-Host " Axiom EDA build & installation completed successfully!" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor Green

Write-Host "Binary Installed: $(Join-Path $BinDir 'axiom.exe')" -ForegroundColor White
$verOutput = (& (Join-Path $BinDir "axiom.exe") --version)
Write-Host "Version:          $verOutput" -ForegroundColor White

# 6. Check and prompt PATH
$userPath = [System.Environment]::GetEnvironmentVariable("PATH", "User")
if ($userPath -notlike "*$BinDir*") {
    Write-Host ""
    Write-Host "[NOTE] $BinDir is not in your User PATH." -ForegroundColor Yellow
    Write-Host "To add it automatically in PowerShell, run:" -ForegroundColor White
    Write-Host "  [System.Environment]::SetEnvironmentVariable('PATH', `$userPath + ';$BinDir', 'User')" -ForegroundColor Cyan
    Write-Host ""
}

Write-Host "Get started with:" -ForegroundColor Gray
Write-Host "  axiom compile tests\fixtures\alu.v -t alu" -ForegroundColor Cyan
Write-Host "  axiom run tests\fixtures\counter.v -t counter --ticks 100 --vcd wave.vcd" -ForegroundColor Cyan
Write-Host "  axiom --help" -ForegroundColor Cyan
