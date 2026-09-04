# ResQX Phase 2 Validation Script
# Single command to validate the complete 4-signal SUMO control loop

$ErrorActionPreference = "Stop"

$dir = "C:\Users\jeswanth poosarla\Desktop\ResQX\sumo-test"
Set-Location $dir

$env:SUMO_HOME = "C:\Program Files (x86)\Eclipse\Sumo"
$env:Path += ";$env:SUMO_HOME\bin"

Write-Host "=================================================="
Write-Host "ResQX Phase 2 Validation"
Write-Host "=================================================="
Write-Host ""

# 1. Validate SUMO_HOME
Write-Host "=== (1) SUMO_HOME validation ==="
if (Test-Path "$env:SUMO_HOME\bin\sumo.exe") {
    Write-Host "  [PASS] sumo.exe found at $env:SUMO_HOME\bin\sumo.exe"
} else {
    Write-Host "  [FAIL] sumo.exe not found at $env:SUMO_HOME\bin\sumo.exe"
    exit 1
}
if (Test-Path "$env:SUMO_HOME\bin\sumo-gui.exe") {
    Write-Host "  [PASS] sumo-gui.exe found"
} else {
    Write-Host "  [WARN] sumo-gui.exe not found (headless only)"
}
if (Test-Path "$env:SUMO_HOME\bin\netconvert.exe") {
    Write-Host "  [PASS] netconvert.exe found"
} else {
    Write-Host "  [FAIL] netconvert.exe not found"
    exit 1
}

# 2. Validate network.net.xml has 4 tlLogic blocks
Write-Host ""
Write-Host "=== (2) Network validation (4 signals) ==="
$content = Get-Content network.net.xml -Raw
$tlMatches = [regex]::Matches($content, 'tlLogic id="(SIG-0[1-4])"')
$seen = @{}
$tlMatches | ForEach-Object {
    $id = $_.Groups[1].Value
    if (-not $seen.ContainsKey($id)) { $seen[$id] = $true }
}
if ($seen.Count -eq 4) {
    Write-Host "  [PASS] Found 4 unique tlLogic IDs: $($seen.Keys -join ', ')"
} else {
    Write-Host "  [FAIL] Expected 4 tlLogic IDs, found $($seen.Count): $($seen.Keys -join ', ')"
    exit 1
}

# 3. Validate routes.rou.xml has full corridor route
Write-Host ""
Write-Host "=== (3) Routes validation ==="
$routesContent = Get-Content routes.rou.xml -Raw
if ($routesContent -match 'route_corridor.*E_CORRIDOR_1.*E_CORRIDOR_2.*E_CORRIDOR_3.*E_CORRIDOR_4.*E_CORRIDOR_5') {
    Write-Host "  [PASS] route_corridor traverses all 5 corridor edges (SIG-01 through SIG-04 + HOSPITAL)"
} else {
    Write-Host "  [FAIL] route_corridor does not include all 5 edges"
    exit 1
}

# 4. Validate simulation.sumocfg has required settings
Write-Host ""
Write-Host "=== (4) SUMO config validation ==="
$cfgContent = Get-Content simulation.sumocfg -Raw
$checks = @(
    @{ Name="step-length=0.5"; Pattern='step-length value="0\.5"' },
    @{ Name="no-step-log=true"; Pattern='no-step-log value="true"' },
    @{ Name="time-to-teleport=-1"; Pattern='time-to-teleport value="-1"' },
    @{ Name="seed=42"; Pattern='seed value="42"' }
)
$allPass = $true
foreach ($c in $checks) {
    if ($cfgContent -match $c.Pattern) {
        Write-Host "  [PASS] $($c.Name)"
    } else {
        Write-Host "  [FAIL] $($c.Name) not found"
        $allPass = $false
    }
}
if (-not $allPass) { exit 1 }

# 5. Validate network can be regenerated (optional sanity check)
Write-Host ""
Write-Host "=== (5) Netconvert round-trip test ==="
$errFile = "$env:TEMP\netconvert_validate_err.txt"
$proc = Start-Process -FilePath "$env:SUMO_HOME\bin\netconvert.exe" `
    -ArgumentList "-n","nodes.nod.xml","-e","edges.edg.xml","-o","network.net.xml.tmp","--tls.default-type","static","--roundabouts.guess","false","--junctions.join","false" `
    -NoNewWindow -Wait -PassThru -RedirectStandardError $errFile
if ($proc.ExitCode -eq 0) {
    Write-Host "  [PASS] netconvert regenerates network successfully"
    Remove-Item "network.net.xml.tmp" -ErrorAction SilentlyContinue
} else {
    Write-Host "  [FAIL] netconvert failed with exit code $($proc.ExitCode)"
    if (Test-Path $errFile) { Get-Content $errFile -Raw | Write-Host }
    exit 1
}
Remove-Item $errFile -ErrorAction SilentlyContinue

# 6. Run the automated signal control test
Write-Host ""
Write-Host "=== (6) Automated Signal Control Test (test_signal_control.py) ==="
$py = (Get-Command python -ErrorAction SilentlyContinue).Source
if (-not $py) {
    $py = "C:\Users\jeswanth poosarla\AppData\Local\Programs\Python\Python311\python.exe"
}
Write-Host "  using python: $py"
$testFile = "test_signal_control.py"
Push-Location $dir
try {
    & $py $testFile
    $exitCode = $LASTEXITCODE
} finally {
    Pop-Location
}

if ($exitCode -eq 0) {
    Write-Host "  [PASS] test_signal_control.py exited with code 0 (ALL 4 SIGNALS: PASS)"
} else {
    Write-Host "  [FAIL] test_signal_control.py exited with code $exitCode"
    exit 1
}

Write-Host ""
Write-Host "=================================================="
Write-Host "PHASE 2 VALIDATION: ALL CHECKS PASSED"
Write-Host "=================================================="
exit 0