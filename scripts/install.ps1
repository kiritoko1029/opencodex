#Requires -Version 5.1
$ErrorActionPreference = "Stop"

Write-Host "Installing opencodex..." -ForegroundColor Cyan

# Check or install Bun
if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "Bun not found. Installing..."
    irm bun.sh/install.ps1 | iex
    $env:PATH = "$env:USERPROFILE\.bun\bin;$env:PATH"
}

$bunVer = & bun --version
Write-Host "Using Bun v$bunVer"

# Install opencodex globally
& bun install -g @bitkyc08/opencodex

Write-Host ""
Write-Host "opencodex installed! Run 'ocx init' to set up." -ForegroundColor Green
