param(
    [switch]$SkipBackend,
    [switch]$SkipFrontend,
    [switch]$RunE2E,
    [int]$BasePort = 8000,
    [int]$MaxPortScan = 30
)

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot

Write-Host "Workspace verify started"
Write-Host "Root: $root"

try {
    if (-not $SkipBackend) {
        Write-Host "[1/2] Backend live smoke"
        Set-Location (Join-Path $root "backend")
        try {
            & ".\scripts\smoke-live.ps1" -BasePort $BasePort -MaxPortScan $MaxPortScan
        }
        catch {
            Write-Warning "Backend live smoke failed: $($_.Exception.Message)"
            Write-Warning "Falling back to backend CI checks (compile + pytest)."
            & ".\scripts\ci-check.ps1"
        }
    }
    else {
        Write-Host "[1/2] Backend live smoke skipped"
    }

    if (-not $SkipFrontend) {
        Write-Host "[2/2] Frontend verify build"
        Set-Location (Join-Path $root "frontend")
        npm run verify

        if ($RunE2E) {
            Write-Host "[2/2] Frontend E2E"
            npm run test:e2e
        }
    }
    else {
        Write-Host "[2/2] Frontend verify build skipped"
    }

    Write-Host "Workspace verify passed"
}
finally {
    Set-Location $root
}
