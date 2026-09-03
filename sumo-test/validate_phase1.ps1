$dir = "C:\Users\jeswanth poosarla\Desktop\ResQX\sumo-test"
Set-Location $dir
$content = Get-Content network.net.xml -Raw

Write-Host "=== (1) tlLogic IDs for SIG-01..SIG-04 ==="
$tlsMatches = [regex]::Matches($content, 'tlLogic id="(SIG-0[1-4])"')
$seen = @{}
$tlsMatches | ForEach-Object {
    $id = $_.Groups[1].Value
    if (-not $seen.ContainsKey($id)) {
        $seen[$id] = $true
        Write-Host "  $id"
    }
}
Write-Host "  Unique count: $($seen.Count)"

Write-Host "`n=== (2) Total tlLogic blocks ==="
$tlBlockCount = ([regex]::Matches($content, '<tlLogic ')).Count
Write-Host "  Count: $tlBlockCount"

Write-Host "`n=== (3) traffic_light junctions for SIG-01..SIG-04 ==="
$juncMatches = [regex]::Matches($content, '<junction id="(SIG-0[1-4])" type="traffic_light"[^>]+x="([^"]+)"[^>]+y="([^"]+)"')
$juncSeen = @{}
$juncMatches | ForEach-Object {
    $id = $_.Groups[1].Value
    $x  = $_.Groups[2].Value
    $y  = $_.Groups[3].Value
    if (-not $juncSeen.ContainsKey($id)) {
        $juncSeen[$id] = $true
        Write-Host "  $id  x=$x  y=$y"
    }
}
Write-Host "  Unique count: $($juncSeen.Count)"

Write-Host "`n=== (4) Total traffic_light junctions in network ==="
$totalTrafCount = ([regex]::Matches($content, 'type="traffic_light"')).Count
Write-Host "  Count: $totalTrafCount"

Write-Host "`n=== (5) Network convBoundary ==="
$boundary = [regex]::Match($content, 'convBoundary="([^"]+)"')
if ($boundary.Success) {
    Write-Host "  convBoundary=""$($boundary.Groups[1].Value)"""
}

Write-Host "`n=== (6) SUMO load test (sumo -c simulation.sumocfg --end 1) ==="
$env:SUMO_HOME = "C:\Program Files (x86)\Eclipse\Sumo"
$env:Path += ";C:\Program Files (x86)\Eclipse\Sumo\bin"
$errFile = "$env:TEMP\sumo_validate_err.txt"
$proc = Start-Process -FilePath "$env:SUMO_HOME\bin\sumo.exe" `
    -ArgumentList "-c","simulation.sumocfg","--end","1" `
    -NoNewWindow -Wait -PassThru -RedirectStandardError $errFile
$exitCode = $proc.ExitCode
Write-Host "  sumo exit code: $exitCode"
if ($exitCode -eq 0) {
    Write-Host "  Result: SUCCESS"
} else {
    Write-Host "  Result: FAIL"
}
if (Test-Path $errFile) {
    $stderr = Get-Content $errFile -Raw
    if ($stderr -and $stderr.Trim() -ne "") {
        Write-Host "  Stderr:"
        $stderr.Split("`n") | Where-Object { $_.Trim() -ne "" } | Select-Object -First 20 | ForEach-Object {
            Write-Host "    $_"
        }
    } else {
        Write-Host "  Stderr: (empty)"
    }
    Remove-Item $errFile -ErrorAction SilentlyContinue
} else {
    Write-Host "  Stderr: (no stderr file)"
}
