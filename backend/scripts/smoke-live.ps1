param(
    [int]$BasePort = 8000,
    [int]$MaxPortScan = 30,
    [string]$BindHost = "127.0.0.1"
)

$ErrorActionPreference = "Stop"

function Get-PythonCommand {
    $venvPython = Join-Path $PSScriptRoot "..\.venv\Scripts\python.exe"
    $venvPython = [System.IO.Path]::GetFullPath($venvPython)

    if (Test-Path $venvPython) {
        return $venvPython
    }

    return "python"
}

function Test-PortAvailable {
    param(
        [string]$BindHost,
        [int]$Port
    )

    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse($BindHost), $Port)
        $listener.Start()
        return $true
    }
    catch {
        return $false
    }
    finally {
        if ($null -ne $listener) {
            $listener.Stop()
        }
    }
}

function Get-AvailablePort {
    param(
        [string]$BindHost,
        [int]$StartPort,
        [int]$ScanLimit
    )

    for ($port = $StartPort; $port -lt ($StartPort + $ScanLimit); $port++) {
        if (Test-PortAvailable -BindHost $BindHost -Port $port) {
            return $port
        }
    }

    throw "No free port found in range $StartPort..$($StartPort + $ScanLimit - 1)."
}

function Wait-HealthReady {
    param(
        [string]$Url,
        [int]$TimeoutSeconds = 20
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

    while ((Get-Date) -lt $deadline) {
        try {
            $res = Invoke-RestMethod -Method Get -Uri $Url -TimeoutSec 2
            if ($res.status -eq "ok") {
                return
            }
        }
        catch {
            # Retry until timeout.
        }
    }

    throw "Server did not become healthy within $TimeoutSeconds seconds at $Url"
}

$python = Get-PythonCommand
$port = Get-AvailablePort -BindHost $BindHost -StartPort $BasePort -ScanLimit $MaxPortScan
$baseUrl = "http://$BindHost`:$port"

Write-Host "Using python: $python"
Write-Host "Applying migrations"
$previousErrorPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$upgradeOutput = & $python -m alembic upgrade head 2>&1
$upgradeExitCode = $LASTEXITCODE
$ErrorActionPreference = $previousErrorPreference

if ($upgradeExitCode -ne 0) {
    $upgradeText = $upgradeOutput | Out-String

    if ($upgradeText -match "already exists") {
        Write-Warning "Detected existing schema without migration metadata. Stamping alembic head."
        $ErrorActionPreference = "Continue"
        & $python -m alembic stamp head | Out-Null
        $stampExitCode = $LASTEXITCODE
        $ErrorActionPreference = $previousErrorPreference

        if ($stampExitCode -ne 0) {
            throw "Alembic stamp failed with exit code $stampExitCode"
        }
    }
    else {
        throw "Alembic upgrade failed with exit code $upgradeExitCode"
    }
}

Write-Host "Seeding admin/products (idempotent)"
& $python -m app.seed | Out-Null

Write-Host "Starting API on $baseUrl"

$serverProcess = $null
try {
    $serverProcess = Start-Process -FilePath $python -ArgumentList "-m", "uvicorn", "app.main:app", "--host", $BindHost, "--port", "$port" -PassThru

    Wait-HealthReady -Url "$baseUrl/health"

    Write-Host "API is healthy. Running verification..."
    & "$PSScriptRoot\verify-api.ps1" -BaseUrl $baseUrl

    Write-Host "Live smoke verification passed"
}
finally {
    if ($null -ne $serverProcess -and -not $serverProcess.HasExited) {
        Write-Host "Stopping API process (PID: $($serverProcess.Id))"
        Stop-Process -Id $serverProcess.Id -Force
    }
}
