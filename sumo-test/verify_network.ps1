$dir = "C:\Users\jeswanth poosarla\Desktop\ResQX\sumo-test"
Set-Location $dir

Write-Host "=== tlLogic declarations ==="
Select-String -Path network.net.xml -Pattern 'tlLogic id='

Write-Host "`n=== E_CORRIDOR edges ==="
Select-String -Path network.net.xml -Pattern 'E_CORRIDOR'

Write-Host "`n=== E_CROSS edges ==="
Select-String -Path network.net.xml -Pattern 'E_CROSS'

Write-Host "`n=== traffic_light junctions ==="
Select-String -Path network.net.xml -Pattern 'type="traffic_light"'

Write-Host "`n=== Network boundary (convBoundary) ==="
Select-String -Path network.net.xml -Pattern 'convBoundary'

Write-Host "`n=== Number of tlLogic blocks ==="
(Select-String -Path network.net.xml -Pattern '<tlLogic ').Count
