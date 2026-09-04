# ResQX — SUMO Integration & Emergency Signal Priority Spike

This directory contains the verified SUMO 1.27.1 integration test and real-time Emergency Traffic Signal Priority algorithm implemented via TraCI (Traffic Control Interface).

## Network Topology

```text
       CAR-02
         ↓
  E_CROSS1_IN (West → East)
         ↓
[N_START] ──E_CORRIDOR_1──> [SIG-01] ──E_CORRIDOR_2──> [SIG-02] ──E_CORRIDOR_3──> [HOSPITAL]
                                 ↑                          ↑
                            E_CROSS1_OUT               E_CROSS2_OUT
                                                            ↑
                                                       E_CROSS2_IN
                                                            ↑
                                                          CAR-03
```

---

## Emergency Priority State Machine

For each signal node (`SIG-01` and `SIG-02`), the algorithm manages a 4-stage state transition lifecycle:

```text
  NORMAL ──(Distance <= 100m)──> PREPARING ──(Distance <= 45m)──> EMERGENCY PRIORITY ──(Crossed)──> RESTORED
```

1. **NORMAL**: Signal operates on its standard SUMO cycle program.
2. **PREPARING**: Triggered when `AMB-01` comes within **100m** of the intersection. Logs approach warning and logs signal preparation state.
3. **EMERGENCY PRIORITY**: Triggered when `AMB-01` comes within **45m** of the intersection. TraCI issues an immediate signal override:
   `traci.trafficlight.setRedYellowGreenState(signal_id, "GGGrr")`
   This forces a solid green wave on the main corridor lanes while locking cross traffic to red.
4. **RESTORED**: Triggered when `AMB-01` completes crossing the intersection onto the next corridor edge. TraCI restores default signal program:
   `traci.trafficlight.setProgram(signal_id, "0")`

---

## Files in `sumo-test/`

| File | Purpose |
| :--- | :--- |
| `nodes.nod.xml` | Defines 3D spatial node coordinates for start point, intersections `SIG-01`..`SIG-04`, cross roads, and destination hospital |
| `edges.edg.xml` | Defines road links, number of lanes, speed limits, and priorities |
| `network.net.xml` | Compiled SUMO network binary generated via `netconvert` |
| `routes.rou.xml` | Defines vehicle classes (`car` vs `emergency`), routes, vehicle departures, and `AMB-01` specs |
| `simulation.sumocfg` | Master SUMO configuration file linking network and route files |
| `telemetry_server.py` | HTTP bridge (port 8000) that owns the TraCI connection and exposes `/api/telemetry`, `/api/control`, `/api/signal`, `/api/alert` |
| `test_signal_control.py` | Automated 4-signal verification: HTTP → bridge → TraCI → SUMO → telemetry loop |
| `test_traci.py` | Standalone TraCI spike (2-signal demo, kept for reference) |
| `validate_phase2.ps1` | Single-command Phase 2 validation script |
| `README.md` | Documentation for the integration spike |

---

## Execution Commands

### 1. Headless TraCI Signal Priority Simulation
```powershell
$env:Path += ";C:\Program Files (x86)\Eclipse\Sumo\bin"
$env:SUMO_HOME = "C:\Program Files (x86)\Eclipse\Sumo"
python test_traci.py
```

### 2. GUI Mode TraCI Signal Priority Simulation
```powershell
$env:Path += ";C:\Program Files (x86)\Eclipse\Sumo\bin"
$env:SUMO_HOME = "C:\Program Files (x86)\Eclipse\Sumo"
python test_traci.py --gui
```

---

## Safety & Isolation Verification

* **Scope**: 100% contained within `sumo-test/`.
* **React App (`src/`)**: **Unmodified** (0 edits).
* **Architecture**: **Unmodified**.
