$env:SUMO_HOME = "C:\Program Files (x86)\Eclipse\Sumo"
$env:Path += ";C:\Program Files (x86)\Eclipse\Sumo\bin"
$env:NTFY_TOPIC = "resqx_demo_test"
Set-Location $PSScriptRoot
$proc = Start-Process -FilePath "python" `
    -ArgumentList '"telemetry_server.py"' `
    -NoNewWindow -PassThru -WorkingDirectory $PSScriptRoot
Write-Host "Telemetry server PID: $($proc.Id)"
Start-Sleep -Seconds 2
Write-Host "Server started with NTFY_TOPIC=$env:NTFY_TOPIC"
