$env:SUMO_HOME = "C:\Program Files (x86)\Eclipse\Sumo"
$env:Path += ";C:\Program Files (x86)\Eclipse\Sumo\bin"
Set-Location $PSScriptRoot
$netconvert = "$env:SUMO_HOME\bin\netconvert.exe"
$args = @(
    "-n", "nodes.nod.xml",
    "-e", "edges.edg.xml",
    "-o", "network.net.xml",
    "--tls.default-type", "static",
    "--roundabouts.guess", "false",
    "--junctions.join", "false",
    "--no-warnings", "false"
)
& $netconvert @args
exit $LASTEXITCODE
