#!/usr/bin/env python3
"""
ResQX — Emergency Signal Priority Implementation in SUMO (TraCI Spike)

This script implements real-time emergency signal priority for AMB-01:
1. Detects AMB-01 position and current edge.
2. Identifies the next signal (SIG-01 or SIG-02) and calculates Euclidean distance.
3. Transitions signal emergency state: NORMAL -> PREPARING -> EMERGENCY PRIORITY -> RESTORED.
4. Overrides SUMO traffic light state to GGGrr during EMERGENCY PRIORITY to ensure green corridor.
5. Restores traffic light to default program once AMB-01 crosses the intersection.
"""

import sys
import os
import time
import math

# Ensure SUMO_HOME is set and tools directory is added to sys.path
if "SUMO_HOME" not in os.environ:
    os.environ["SUMO_HOME"] = r"C:\Program Files (x86)\Eclipse\Sumo"

sumo_tools = os.path.join(os.environ["SUMO_HOME"], "tools")
if sumo_tools not in sys.path:
    sys.path.append(sumo_tools)

# Ensure binary dir is in PATH
sumo_bin = os.path.join(os.environ["SUMO_HOME"], "bin")
if sumo_bin not in os.environ["PATH"]:
    os.environ["PATH"] += os.pathsep + sumo_bin

import traci

# Signal Positions (from network geometry)
SIG_POSITIONS = {
    "SIG-01": (100.0, 200.0),
    "SIG-02": (100.0, 100.0),
}

# Distance Thresholds (meters)
THRESHOLD_PREPARING = 100.0  # 100m approach threshold
THRESHOLD_PRIORITY = 45.0    # 45m emergency priority threshold

def run_simulation(gui=False):
    config_file = os.path.join(os.path.dirname(__file__), "simulation.sumocfg")
    sumo_binary = "sumo-gui" if gui else "sumo"
    
    print("==================================================")
    print("ResQX Emergency Signal Priority Simulation")
    print(f"Binary: {sumo_binary}")
    print(f"Config: {config_file}")
    print("==================================================")

    sumo_cmd = [sumo_binary, "-c", config_file, "--start", "--quit-on-end", "true"]
    
    try:
        traci.start(sumo_cmd)
        print("[OK] TraCI successfully connected to SUMO process.")
    except Exception as e:
        print(f"[FAIL] Failed to start with {sumo_binary}: {e}")
        if gui:
            print("Fallback to CLI mode (sumo)...")
            sumo_cmd[0] = "sumo"
            traci.start(sumo_cmd)
            print("[OK] TraCI connected in CLI mode.")

    # Emergency Priority state tracking for SIG-01 and SIG-02
    signal_states = {
        "SIG-01": "NORMAL",
        "SIG-02": "NORMAL",
    }
    
    amb_active_previously = False
    amb_arrived = False
    step = 0

    print("\n--- Starting ResQX Emergency Priority Simulation Loop ---\n")

    while step < 150:
        traci.simulationStep()
        step += 1
        
        vehicles = traci.vehicle.getIDList()
        tl_ids = traci.trafficlight.getIDList()

        if "AMB-01" in vehicles:
            amb_active_previously = True
            pos = traci.vehicle.getPosition("AMB-01")
            speed_mps = traci.vehicle.getSpeed("AMB-01")
            speed_kmh = speed_mps * 3.6
            road_id = traci.vehicle.getRoadID("AMB-01")

            # Determine next signal and distance based on current road
            next_sig = None
            dist_to_sig = 0.0

            if road_id in ("E_CORRIDOR_1", ":N_START_0"):
                next_sig = "SIG-01"
                sig_pos = SIG_POSITIONS["SIG-01"]
                dist_to_sig = math.hypot(pos[0] - sig_pos[0], pos[1] - sig_pos[1])
            elif road_id in ("E_CORRIDOR_2", ":SIG-01_0", ":SIG-01_1", ":SIG-01_2"):
                # If AMB-01 has crossed SIG-01 onto E_CORRIDOR_2 or junction, restore SIG-01
                if signal_states["SIG-01"] in ("PREPARING", "EMERGENCY PRIORITY"):
                    signal_states["SIG-01"] = "RESTORED"
                    traci.trafficlight.setProgram("SIG-01", "0")
                    print(f"\n[AMB-01] Passed SIG-01")
                    print(f"[SIG-01] RESTORED\n")

                next_sig = "SIG-02"
                sig_pos = SIG_POSITIONS["SIG-02"]
                dist_to_sig = math.hypot(pos[0] - sig_pos[0], pos[1] - sig_pos[1])
            elif road_id in ("E_CORRIDOR_3", ":SIG-02_0", ":SIG-02_1", ":SIG-02_2"):
                # If AMB-01 has crossed SIG-02 onto E_CORRIDOR_3 or junction, restore SIG-02
                if signal_states["SIG-02"] in ("PREPARING", "EMERGENCY PRIORITY"):
                    signal_states["SIG-02"] = "RESTORED"
                    traci.trafficlight.setProgram("SIG-02", "0")
                    print(f"\n[AMB-01] Passed SIG-02")
                    print(f"[SIG-02] RESTORED\n")

                next_sig = "HOSPITAL"
                dist_to_sig = math.hypot(pos[0] - 100.0, pos[1] - 0.0)

            # Evaluate Emergency Signal Priority transitions for the next signal
            if next_sig in ("SIG-01", "SIG-02"):
                current_state = signal_states[next_sig]
                
                # Check transition to PREPARING
                if dist_to_sig <= THRESHOLD_PREPARING and current_state == "NORMAL":
                    signal_states[next_sig] = "PREPARING"
                    print(f"\n[AMB-01] Approaching {next_sig}")
                    print(f"[{next_sig}] PREPARING\n")

                # Check transition to EMERGENCY PRIORITY
                if dist_to_sig <= THRESHOLD_PRIORITY and signal_states[next_sig] in ("NORMAL", "PREPARING"):
                    signal_states[next_sig] = "EMERGENCY PRIORITY"
                    # Force signal to green for corridor (GGGrr)
                    traci.trafficlight.setRedYellowGreenState(next_sig, "GGGrr")
                    print(f"\n[{next_sig}] EMERGENCY PRIORITY\n")

            # Telemetry Output
            sig_state_display = signal_states[next_sig] if next_sig in signal_states else "EN_ROUTE"
            raw_tl_state = traci.trafficlight.getRedYellowGreenState(next_sig) if next_sig in tl_ids else "N/A"

            print(f"[Step {step:03d}]")
            print(f"AMB-01 | Speed: {speed_kmh:.0f} km/h")
            print(f"Road: {road_id}")
            print(f"Next: {next_sig}")
            print(f"Distance: {dist_to_sig:.0f}m")
            print(f"Signal: {sig_state_display} (TL State: {raw_tl_state})")
            print("-" * 35)

        elif amb_active_previously and not amb_arrived:
            amb_arrived = True
            print(f"\n[AMB-01] ARRIVED AT HOSPITAL\n")
            break
        elif step % 10 == 0:
            print(f"[Step {step:03d}] Active Vehicles: {len(vehicles)} | SIG-01: {signal_states['SIG-01']} | SIG-02: {signal_states['SIG-02']}")

        time.sleep(0.05 if gui else 0.001)

    print("==================================================")
    print("ResQX Emergency Signal Priority Summary:")
    print(f"  Total Steps: {step}")
    print(f"  AMB-01 Active: {amb_active_previously}")
    print(f"  SIG-01 Priority Triggered & Restored: {signal_states['SIG-01'] == 'RESTORED'}")
    print(f"  SIG-02 Priority Triggered & Restored: {signal_states['SIG-02'] == 'RESTORED'}")
    print(f"  AMB-01 Arrived at Hospital: {amb_arrived}")
    print("==================================================")

    traci.close()
    print("[OK] TraCI connection closed cleanly.")

if __name__ == "__main__":
    use_gui = "--gui" in sys.argv or "-g" in sys.argv
    run_simulation(gui=use_gui)
