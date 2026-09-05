$dir = "C:\Users\jeswanth poosarla\Desktop\ResQX\sumo-test"
Set-Location $dir
$env:SUMO_HOME = "C:\Program Files (x86)\Eclipse\Sumo"
$env:Path += ";C:\Program Files (x86)\Eclipse\Sumo\bin"

$errFile = "$env:TEMP\sumo_validate_err.txt"

Write-Host "=== SUMO load + 1-step validation ==="
$proc = Start-Process -FilePath "$env:SUMO_HOME\bin\sumo.exe" `
    -ArgumentList "-c","simulation.sumocfg","--end","1" `
    -NoNewWindow -Wait -PassThru -RedirectStandardError $errFile

$exitCode = $proc.ExitCode
Write-Host "  sumo exit code: $exitCode"

if ($exitCode -eq 0) {
    Write-Host "  Load result: SUCCESS"
} else {
    Write-Host "  Load result: FAIL (exit $exitCode)"
}

if (Test-Path $errFile) {
    $stderr = Get-Content $errFile -Raw
    if ($stderr -and $stderr.Trim() -ne "") {
        Write-Host "  Stderr:"
        $stderr.Split("`n") | Where-Object { $_.Trim() -ne "" } | Select-Object -First 20 | ForEach-Object {
            Write-Host "    $_"
        }
    } else {
        Write-Host "  Stderr: (empty -- no errors)"
    }
    Remove-Item $errFile -ErrorAction SilentlyContinue
} else {
    Write-Host "  Stderr: (no stderr file produced)"
}

Write-Host ""
Write-Host "=== done ==="
