$ErrorActionPreference = "Stop"

function Get-PythonCommand {
	$venvPython = Join-Path $PSScriptRoot "..\.venv\Scripts\python.exe"
	$venvPython = [System.IO.Path]::GetFullPath($venvPython)

	if (Test-Path $venvPython) {
		return $venvPython
	}

	return "python"
}

$python = Get-PythonCommand
Write-Host "Using python: $python"

Write-Host "[1/2] Python compile check"
& $python -m compileall app
if ($LASTEXITCODE -ne 0) {
	throw "Python compile check failed with exit code $LASTEXITCODE"
}

Write-Host "[2/2] Pytest"
& $python -m pytest -q
if ($LASTEXITCODE -ne 0) {
	throw "Pytest failed with exit code $LASTEXITCODE"
}

Write-Host "Backend CI-style checks passed"
