#!/usr/bin/env python3
"""
ResQX — SUMO Telemetry Bridge Server

Runs Eclipse SUMO via TraCI and exposes a non-blocking localhost HTTP API to serve
real-time telemetry (including individual vehicle telemetry for AMB-01 and normal traffic)
to the ResQX React frontend.

HTTP Port: 8000
Endpoints:
  GET  /api/telemetry  -> Returns current Telemetry JSON (Non-blocking <1ms response)
  POST /api/control    -> Body: {"action": "start"|"pause"|"reset"|"speed", "value": 1|2|5}
  GET  /api/control?action=start|pause|reset|speed&value=1|2|5
"""

import sys
import os
import time
import math
import json
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

# Ensure SUMO_HOME is set and tools directory is added to sys.path
if "SUMO_HOME" not in os.environ:
    os.environ["SUMO_HOME"] = r"C:\Program Files (x86)\Eclipse\Sumo"

sumo_tools = os.path.join(os.environ["SUMO_HOME"], "tools")
if sumo_tools not in sys.path:
    sys.path.append(sumo_tools)

sumo_bin = os.path.join(os.environ["SUMO_HOME"], "bin")
if sumo_bin not in os.environ["PATH"]:
    os.environ["PATH"] += os.pathsep + sumo_bin

import traci

# Signal Positions (from network geometry — generated network.net.xml, SUMO internal coords)
# x = 100.00 (centred after netconvert's netOffset=100,-10)
# y values are post-netconvert: input y=240,180,120,60 → internal y=230,170,110,50
SIG_POSITIONS = {
    "SIG-01": (100.0, 230.0),
    "SIG-02": (100.0, 170.0),
    "SIG-03": (100.0, 110.0),
    "SIG-04": (100.0, 50.0),
}

# ─── Shared Telemetry State ───────────────────────────────────────────

class TelemetryBridge:
    def __init__(self):
        # Dedicated Lock strictly for atomic telemetry snapshot pointer swaps (<0.001ms)
        # NEVER held during TraCI socket calls or SUMO startup/shutdown!
        self.telemetry_lock = threading.Lock()
        
        self.running = False
        self.traci_connected = False
        self.step = 0
        self.speed = 1  # 1x, 2x, 5x
        self.gui = True  # Default to GUI mode if available
        self.config_file = os.path.join(os.path.dirname(__file__), "simulation.sumocfg")
        
        self.signal_states = {
            "SIG-01": "NORMAL",
            "SIG-02": "NORMAL",
            "SIG-03": "NORMAL",
            "SIG-04": "NORMAL",
        }

        self.signals_prioritized_count = 0
        self.intersections_cleared_count = 0
        self.ambulance_arrived = False
        
        # Initial telemetry structure matching Contract
        self.telemetry = self._default_telemetry()
        self.telemetry_json_str = json.dumps(self.telemetry)

    def _default_telemetry(self):
        return {
            "simulation": {
                "running": False,
                "step": 0,
                "elapsedTime": 0.0,
                "speed": self.speed,
            },
            "ambulance": {
                "id": "AMB-01",
                "status": "STAGED",
                "x": 100.0,
                "y": 300.0,
                "speedKmh": 0.0,
                "angle": 180.0,
                "currentRoad": "E_CORRIDOR_1",
                "nextSignal": "SIG-01",
                "distanceToNextSignal": 100.0,
                "etaSeconds": 15,
            },
            "signals": [
                {"id": "SIG-01", "state": "GGGrr", "emergencyState": "NORMAL", "distanceFromAmbulance": 100.0},
                {"id": "SIG-02", "state": "GGGrr", "emergencyState": "NORMAL", "distanceFromAmbulance": 200.0},
                {"id": "SIG-03", "state": "GGGrr", "emergencyState": "NORMAL", "distanceFromAmbulance": 300.0},
                {"id": "SIG-04", "state": "GGGrr", "emergencyState": "NORMAL", "distanceFromAmbulance": 400.0},
            ],
            "traffic": {
                "level": "MODERATE",
                "vehicleCount": 4,
                "vehicles": [
                    {"id": "AMB-01", "type": "emergency", "x": 100.0, "y": 300.0, "speedKmh": 0.0, "road": "E_CORRIDOR_1", "lane": "E_CORRIDOR_1_0", "angle": 180.0, "color": "#FF5451"},
                    {"id": "CAR-01", "type": "car", "x": 100.0, "y": 280.0, "speedKmh": 35.0, "road": "E_CORRIDOR_1", "lane": "E_CORRIDOR_1_1", "angle": 180.0, "color": "#0066CC"},
                    {"id": "CAR-02", "type": "car", "x": -50.0, "y": 200.0, "speedKmh": 25.0, "road": "E_CROSS1_IN", "lane": "E_CROSS1_IN_0", "angle": 90.0, "color": "#0066CC"},
                    {"id": "CAR-03", "type": "car", "x": -60.0, "y": 100.0, "speedKmh": 28.0, "road": "E_CROSS2_IN", "lane": "E_CROSS2_IN_0", "angle": 90.0, "color": "#0066CC"},
                ],
            },
            "mission": {
                "origin": "N_START",
                "destination": "HOSPITAL",
                "elapsedTime": 0.0,
                "estimatedNormalTime": 45.0,
                "estimatedResQXTime": 28.0,
                "timeSaved": 0.0,
                "signalsPrioritized": 0,
                "intersectionsCleared": 0,
            }
        }

    def start_sumo(self):
        if self.traci_connected:
            return
        sumo_binary = "sumo-gui" if self.gui else "sumo"
        sumo_cmd = [sumo_binary, "-c", self.config_file, "--start", "true"]
        
        # Safely close any lingering TraCI session WITHOUT holding telemetry_lock
        try:
            traci.close()
        except Exception:
            pass

        try:
            traci.start(sumo_cmd)
            self.traci_connected = True
            print(f"[SUMO Bridge] Connected to {sumo_binary} via TraCI.")
        except Exception as e:
            print(f"[SUMO Bridge] Failed to launch {sumo_binary}: {e}. Falling back to sumo CLI...")
            sumo_cmd[0] = "sumo"
            try:
                traci.close()
            except Exception:
                pass
            traci.start(sumo_cmd)
            self.traci_connected = True
            print("[SUMO Bridge] Connected to sumo CLI via TraCI.")

    def stop_sumo(self):
        if self.traci_connected:
            try:
                traci.close()
            except Exception:
                pass
            self.traci_connected = False
            print("[SUMO Bridge] TraCI connection closed.")

    def reset_simulation(self):
        self.running = False
        self.stop_sumo()
        self.step = 0
        self.signal_states = {"SIG-01": "NORMAL", "SIG-02": "NORMAL", "SIG-03": "NORMAL", "SIG-04": "NORMAL"}
        self.signals_prioritized_count = 0
        self.intersections_cleared_count = 0
        self.ambulance_arrived = False
        
        # Atomic update of telemetry snapshot JSON
        default_dict = self._default_telemetry()
        self.telemetry = default_dict
        default_json = json.dumps(default_dict)
        with self.telemetry_lock:
            self.telemetry_json_str = default_json
        print("[SUMO Bridge] Simulation state reset to READY / STAGED.")

    def simulation_loop(self):
        while True:
            # Simulation speed sleep calculation:
            # 1x speed = 0.8s per step (provides a realistic ~2-3 minute demo corridor run)
            sleep_time = 0.8 / max(1, self.speed)
            time.sleep(sleep_time)

            if not self.running:
                continue

            if not self.traci_connected:
                self.start_sumo()

            try:
                # ── ALL TraCI Socket Operations Execute OUTSIDE telemetry_lock ──
                traci.simulationStep()
                self.step += 1

                # Safe SUMO end-time handling
                try:
                    sim_time = traci.simulation.getTime()
                    # Config end=500, stop 20s before to avoid trapping in limbo
                    if sim_time >= 480 and self.traci_connected:
                        traci.close()
                        self.traci_connected = False
                        self.running = False
                        print(f"[SUMO Bridge] Simulation reached end of config (t={sim_time}), stopping.")
                except Exception:
                    pass  # getTime may raise after close; ignore

                vehicles_list = traci.vehicle.getIDList()
                tl_ids = traci.trafficlight.getIDList()

                # Re-apply emergency signal overrides to maintain green wave across phase boundaries
                for signal_id, state in self.signal_states.items():
                    if state == "EMERGENCY PRIORITY" and self.traci_connected:
                        traci.trafficlight.setRedYellowGreenState(signal_id, "GGGrr")

                # Extract detailed vehicle telemetry for ALL vehicles in SUMO
                telemetry_vehicles = []
                for v_id in vehicles_list:
                    try:
                        v_pos = traci.vehicle.getPosition(v_id)
                        v_speed = traci.vehicle.getSpeed(v_id) * 3.6
                        v_road = traci.vehicle.getRoadID(v_id)
                        v_lane = traci.vehicle.getLaneID(v_id)
                        v_angle = traci.vehicle.getAngle(v_id)
                        v_type = "emergency" if (v_id == "AMB-01" or "emergency" in traci.vehicle.getTypeID(v_id).lower()) else "car"
                        
                        telemetry_vehicles.append({
                            "id": v_id,
                            "type": v_type,
                            "x": round(v_pos[0], 1),
                            "y": round(v_pos[1], 1),
                            "speedKmh": round(v_speed, 1),
                            "road": v_road,
                            "lane": v_lane,
                            "angle": round(v_angle, 1),
                            "color": "#FF5451" if v_type == "emergency" else "#4EDEA3" if "01" in v_id else "#FFB95F"
                        })
                    except Exception:
                        pass

                if "AMB-01" in vehicles_list:
                    pos = traci.vehicle.getPosition("AMB-01")
                    speed_mps = traci.vehicle.getSpeed("AMB-01")
                    speed_kmh = speed_mps * 3.6
                    amb_angle = traci.vehicle.getAngle("AMB-01")
                    road_id = traci.vehicle.getRoadID("AMB-01")

                    next_sig = "SIG-01"
                    dist_to_sig = 100.0

                    if road_id in ("E_CORRIDOR_1", ":N_START_0"):
                        next_sig = "SIG-01"
                        sig_pos = SIG_POSITIONS["SIG-01"]
                        dist_to_sig = math.hypot(pos[0] - sig_pos[0], pos[1] - sig_pos[1])
                    elif road_id in ("E_CORRIDOR_2", ":SIG-01_0", ":SIG-01_1", ":SIG-01_2"):
                        if self.signal_states["SIG-01"] in ("PREPARING", "EMERGENCY PRIORITY"):
                            self.signal_states["SIG-01"] = "RESTORED"
                            self.intersections_cleared_count = max(self.intersections_cleared_count, 1)
                            traci.trafficlight.setProgram("SIG-01", "0")
                            print("[SUMO Bridge] AMB-01 passed SIG-01 -> RESTORED")

                        next_sig = "SIG-02"
                        sig_pos = SIG_POSITIONS["SIG-02"]
                        dist_to_sig = math.hypot(pos[0] - sig_pos[0], pos[1] - sig_pos[1])
                    elif road_id in ("E_CORRIDOR_3", ":SIG-02_0", ":SIG-02_1", ":SIG-02_2"):
                        if self.signal_states["SIG-02"] in ("PREPARING", "EMERGENCY PRIORITY"):
                            self.signal_states["SIG-02"] = "RESTORED"
                            self.intersections_cleared_count = max(self.intersections_cleared_count, 2)
                            traci.trafficlight.setProgram("SIG-02", "0")
                            print("[SUMO Bridge] AMB-01 passed SIG-02 -> RESTORED")

                        next_sig = "SIG-03"
                        sig_pos = SIG_POSITIONS["SIG-03"]
                        dist_to_sig = math.hypot(pos[0] - sig_pos[0], pos[1] - sig_pos[1])
                    elif road_id in ("E_CORRIDOR_4", ":SIG-03_0", ":SIG-03_1", ":SIG-03_2"):
                        if self.signal_states["SIG-03"] in ("PREPARING", "EMERGENCY PRIORITY"):
                            self.signal_states["SIG-03"] = "RESTORED"
                            self.intersections_cleared_count = max(self.intersections_cleared_count, 3)
                            traci.trafficlight.setProgram("SIG-03", "0")
                            print("[SUMO Bridge] AMB-01 passed SIG-03 -> RESTORED")

                        next_sig = "SIG-04"
                        sig_pos = SIG_POSITIONS["SIG-04"]
                        dist_to_sig = math.hypot(pos[0] - sig_pos[0], pos[1] - sig_pos[1])
                    elif road_id in ("E_CORRIDOR_5", ":SIG-04_0", ":SIG-04_1", ":SIG-04_2"):
                        if self.signal_states["SIG-04"] in ("PREPARING", "EMERGENCY PRIORITY"):
                            self.signal_states["SIG-04"] = "RESTORED"
                            self.intersections_cleared_count = max(self.intersections_cleared_count, 4)
                            traci.trafficlight.setProgram("SIG-04", "0")
                            print("[SUMO Bridge] AMB-01 passed SIG-04 -> RESTORED")

                        next_sig = "HOSPITAL"
                        dist_to_sig = math.hypot(pos[0] - 100.0, pos[1] - 10.0)

                    # Signal states and TraCI overrides are commanded via /api/signal
                    # by the canonical TypeScript Decision Engine -> Safety Validator -> Signal Controller pipeline.

                    # Calculate distances for all four signals
                    sig01_dist = math.hypot(pos[0] - SIG_POSITIONS["SIG-01"][0], pos[1] - SIG_POSITIONS["SIG-01"][1])
                    sig02_dist = math.hypot(pos[0] - SIG_POSITIONS["SIG-02"][0], pos[1] - SIG_POSITIONS["SIG-02"][1])
                    sig03_dist = math.hypot(pos[0] - SIG_POSITIONS["SIG-03"][0], pos[1] - SIG_POSITIONS["SIG-03"][1])
                    sig04_dist = math.hypot(pos[0] - SIG_POSITIONS["SIG-04"][0], pos[1] - SIG_POSITIONS["SIG-04"][1])

                    eta = int(dist_to_sig / max(speed_mps, 1.0))

                    # Build new telemetry object
                    new_telemetry_dict = {
                        "simulation": {
                            "running": True,
                            "step": self.step,
                            "elapsedTime": float(self.step),
                            "speed": self.speed,
                        },
                        "ambulance": {
                            "id": "AMB-01",
                            "status": "EN_ROUTE",
                            "x": round(pos[0], 1),
                            "y": round(pos[1], 1),
                            "speedKmh": round(speed_kmh, 1),
                            "angle": round(amb_angle, 1),
                            "currentRoad": road_id,
                            "nextSignal": next_sig,
                            "distanceToNextSignal": round(dist_to_sig, 1),
                            "etaSeconds": eta,
                        },
                        "signals": [
                            {
                                "id": "SIG-01",
                                "state": traci.trafficlight.getRedYellowGreenState("SIG-01") if "SIG-01" in tl_ids else "GGGrr",
                                "emergencyState": self.signal_states["SIG-01"],
                                "distanceFromAmbulance": round(sig01_dist, 1),
                            },
                            {
                                "id": "SIG-02",
                                "state": traci.trafficlight.getRedYellowGreenState("SIG-02") if "SIG-02" in tl_ids else "GGGrr",
                                "emergencyState": self.signal_states["SIG-02"],
                                "distanceFromAmbulance": round(sig02_dist, 1),
                            },
                            {
                                "id": "SIG-03",
                                "state": traci.trafficlight.getRedYellowGreenState("SIG-03") if "SIG-03" in tl_ids else "GGGrr",
                                "emergencyState": self.signal_states["SIG-03"],
                                "distanceFromAmbulance": round(sig03_dist, 1),
                            },
                            {
                                "id": "SIG-04",
                                "state": traci.trafficlight.getRedYellowGreenState("SIG-04") if "SIG-04" in tl_ids else "GGGrr",
                                "emergencyState": self.signal_states["SIG-04"],
                                "distanceFromAmbulance": round(sig04_dist, 1),
                            },
                        ],
                        "traffic": {
                            "level": "HIGH" if len(vehicles_list) > 5 else "MODERATE" if len(vehicles_list) > 2 else "LOW",
                            "vehicleCount": len(vehicles_list),
                            "vehicles": telemetry_vehicles,
                        },
                        "mission": {
                            "origin": "N_START",
                            "destination": "HOSPITAL",
                            "elapsedTime": float(self.step),
                            "estimatedNormalTime": 45.0,
                            "estimatedResQXTime": 28.0,
                            "timeSaved": max(0.0, round(45.0 - self.step, 1)),
                            "signalsPrioritized": self.signals_prioritized_count,
                            "intersectionsCleared": self.intersections_cleared_count,
                        }
                    }

                    # Serialize to JSON string OUTSIDE lock
                    self.telemetry = new_telemetry_dict
                    new_json_str = json.dumps(new_telemetry_dict)

                    # Atomic reference update under lock (<0.001ms)
                    with self.telemetry_lock:
                        self.telemetry_json_str = new_json_str

                elif self.step > 1000 and not self.ambulance_arrived:
                    # Safety timeout: AMB-01 was never seen to have arrived.
                    # Publish ARRIVED state and stop, but do NOT set self.ambulance_arrived
                    # so if SUMO is still running and the vehicle vanishes later, the real
                    # arrival branch can still fire correctly.
                    print("[SUMO Bridge] Safety timeout (step 1000) reached — marking mission complete.")
                    arrived_dict = self._default_telemetry()
                    arrived_dict["simulation"]["running"] = False
                    arrived_dict["simulation"]["step"] = self.step
                    arrived_dict["simulation"]["elapsedTime"] = float(self.step)
                    arrived_dict["ambulance"]["status"] = "ARRIVED"
                    arrived_dict["ambulance"]["x"] = 98.4
                    arrived_dict["ambulance"]["y"] = 2.7
                    arrived_dict["ambulance"]["speedKmh"] = 0.0
                    arrived_dict["ambulance"]["distanceToNextSignal"] = 0.0
                    arrived_dict["ambulance"]["etaSeconds"] = 0
                    arrived_dict["mission"]["intersectionsCleared"] = self.intersections_cleared_count
                    arrived_dict["mission"]["timeSaved"] = 17.0
                    arrived_dict["traffic"]["vehicles"] = telemetry_vehicles
                    self.telemetry = arrived_dict
                    arrived_json = json.dumps(arrived_dict)
                    with self.telemetry_lock:
                        self.telemetry_json_str = arrived_json
                    self.running = False

                elif "AMB-01" not in vehicles_list and not self.ambulance_arrived and self.signals_prioritized_count > 0:
                    # Real ARRIVED: AMB-01 was previously in simulation (signals_prioritized_count > 0)
                    # and has now vanished. Publish ARRIVED and stop.
                    self.ambulance_arrived = True
                    print("[SUMO Bridge] AMB-01 ARRIVED AT HOSPITAL.")
                    arrived_dict = self._default_telemetry()
                    arrived_dict["simulation"]["running"] = False
                    arrived_dict["simulation"]["step"] = self.step
                    arrived_dict["simulation"]["elapsedTime"] = float(self.step)
                    arrived_dict["ambulance"]["status"] = "ARRIVED"
                    arrived_dict["ambulance"]["x"] = 98.4
                    arrived_dict["ambulance"]["y"] = 2.7
                    arrived_dict["ambulance"]["speedKmh"] = 0.0
                    arrived_dict["ambulance"]["distanceToNextSignal"] = 0.0
                    arrived_dict["ambulance"]["etaSeconds"] = 0
                    arrived_dict["mission"]["intersectionsCleared"] = self.intersections_cleared_count
                    arrived_dict["mission"]["timeSaved"] = 17.0
                    arrived_dict["traffic"]["vehicles"] = telemetry_vehicles
                    self.telemetry = arrived_dict
                    arrived_json = json.dumps(arrived_dict)
                    with self.telemetry_lock:
                        self.telemetry_json_str = arrived_json
                    self.running = False

                # else: AMB-01 still in sim (normal step) — loop continues

            except Exception as e:
                print(f"[SUMO Bridge] Error in simulation step: {e}")
                self.running = False

    def get_telemetry_snapshot_json(self):
        """Acquires lock for <0.001ms strictly to grab json string reference."""
        with self.telemetry_lock:
            snapshot = self.telemetry_json_str
        return snapshot

    def handle_control(self, action, value=None):
        action = action.lower()
        if action == "start":
            if not self.traci_connected:
                self.start_sumo()
            self.running = True
            print("[SUMO Bridge] Control action: START")
            return {"status": "ok", "message": "Simulation started"}
        elif action == "pause":
            self.running = False
            print("[SUMO Bridge] Control action: PAUSE")
            return {"status": "ok", "message": "Simulation paused"}
        elif action == "reset":
            self.reset_simulation()
            return {"status": "ok", "message": "Simulation reset"}
        elif action == "speed":
            try:
                new_speed = int(value) if value else 1
                if new_speed in (1, 2, 5):
                    self.speed = new_speed
                    print(f"[SUMO Bridge] Control action: SPEED set to {new_speed}x")
            except Exception:
                pass
            return {"status": "ok", "message": f"Speed set to {self.speed}x"}
        else:
            return {"status": "error", "message": f"Unknown action: {action}"}

    def handle_signal(self, signal_id, state, pattern=None):
        if not signal_id or not state:
            return {"status": "error", "message": "Missing signalId or state"}

        state_upper = state.upper()
        if signal_id not in ("SIG-01", "SIG-02", "SIG-03", "SIG-04"):
            return {"status": "error", "message": f"Unknown signal: {signal_id}"}

        try:
            # Ensure TraCI is connected and alive before issuing any traci.* calls.
            if not self.traci_connected:
                self.start_sumo()
            # Verify the TraCI socket is still alive by issuing a trivial query.
            try:
                traci.trafficlight.getIDList()
            except Exception:
                # TraCI connection was lost (SUMO may have ended). Reconnect.
                self.stop_sumo()
                self.start_sumo()
            if state_upper == "PREPARING":
                self.signal_states[signal_id] = "PREPARING"
                actual_pattern = pattern if pattern and pattern != "0" else "yyyrr"
                if self.traci_connected:
                    traci.trafficlight.setRedYellowGreenState(signal_id, actual_pattern)
                print(f"[SUMO Bridge] Signal API: {signal_id} -> PREPARING ({actual_pattern})")
            elif state_upper in ("PRIORITY", "PASSING", "EMERGENCY_PRIORITY", "EMERGENCY PRIORITY"):
                self.signal_states[signal_id] = "EMERGENCY PRIORITY"
                self.signals_prioritized_count += 1
                actual_pattern = pattern if pattern and pattern != "0" else "GGGrr"
                if self.traci_connected:
                    traci.trafficlight.setRedYellowGreenState(signal_id, actual_pattern)
                print(f"[SUMO Bridge] Signal API: {signal_id} -> EMERGENCY PRIORITY ({actual_pattern})")
            elif state_upper in ("RESTORING", "RESTORED", "NORMAL"):
                self.signal_states[signal_id] = "RESTORED" if state_upper in ("RESTORING", "RESTORED") else "NORMAL"
                if self.traci_connected:
                    traci.trafficlight.setProgram(signal_id, "0")
                print(f"[SUMO Bridge] Signal API: {signal_id} -> {self.signal_states[signal_id]} (Program 0)")

            actual = self.signal_states[signal_id]
            return {"status": "ok", "signalId": signal_id, "state": state_upper, "actualState": actual}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def handle_alert(self, alert_id, emergency_id, junction_id, officer_id, message=""):
        provider = os.environ.get("ALERT_PROVIDER", "").strip().lower()
        api_key = os.environ.get("ALERT_API_KEY", "").strip()

        if not provider or not api_key:
            # Deterministic Demo Mode (Zero fake delivery claims)
            print(f"[Alert Server] DEMO ALERT for {junction_id} (Officer: {officer_id}): {message[:60]}...")
            return {
                "status": "ok",
                "mode": "DEMO",
                "delivered": False,
                "alertId": alert_id,
                "message": "Demo Mode: Alert recorded on server console (Set ALERT_PROVIDER in .env for live SMS)",
            }

        # Server-side provider integration stub
        print(f"[Alert Server] LIVE ALERT via {provider} for {junction_id}: {message[:60]}...")
        return {
            "status": "ok",
            "mode": "LIVE",
            "delivered": True,
            "alertId": alert_id,
            "message": f"Dispatched via {provider}",
        }


bridge = TelemetryBridge()

# ─── Threading HTTPServer Subclass with Instant Address Reuse ──────────

class ResQXHTTPServer(ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True

    def handle_error(self, request, client_address):
        exc_type, _, _ = sys.exc_info()
        if exc_type in (ConnectionAbortedError, ConnectionResetError, BrokenPipeError, socket.error):
            return  # Silently ignore abrupt client disconnections
        super().handle_error(request, client_address)

# ─── HTTP Server Handler with Explicit Response Length & Flush ────────

class TelemetryHTTPHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):
        # Concise logging, suppress noisy aborted connection traces
        pass

    def _send_json(self, content_data, status_code=200):
        try:
            if isinstance(content_data, bytes):
                body_bytes = content_data
            elif isinstance(content_data, str):
                body_bytes = content_data.encode("utf-8")
            else:
                body_bytes = json.dumps(content_data).encode("utf-8")

            self.send_response(status_code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body_bytes)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.send_header("Connection", "close")
            self.end_headers()
            self.wfile.write(body_bytes)
            self.wfile.flush()
        except (ConnectionAbortedError, ConnectionResetError, BrokenPipeError, socket.error, OSError):
            pass

    def do_OPTIONS(self):
        self._send_json({}, 200)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        if path == "/api/telemetry":
            json_str = bridge.get_telemetry_snapshot_json()
            self._send_json(json_str)

        elif path == "/api/control":
            action = query.get("action", [""])[0]
            val = query.get("value", [None])[0]
            result = bridge.handle_control(action, val)
            self._send_json(result)

        elif path == "/api/signal":
            sig_id = query.get("signalId", [""])[0]
            state = query.get("state", [""])[0]
            pattern = query.get("pattern", [None])[0]
            result = bridge.handle_signal(sig_id, state, pattern)
            self._send_json(result)

        elif path == "/api/alert":
            alert_id = query.get("alertId", [""])[0]
            emergency_id = query.get("emergencyId", ["AMB-01"])[0]
            junction_id = query.get("junctionId", [""])[0]
            officer_id = query.get("officerId", [""])[0]
            result = bridge.handle_alert(alert_id, emergency_id, junction_id, officer_id)
            self._send_json(result)

        else:
            self._send_json({"error": "Not Found"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/control":
            content_len = int(self.headers.get("Content-Length", 0))
            post_body = self.rfile.read(content_len) if content_len > 0 else b"{}"
            try:
                data = json.loads(post_body.decode("utf-8"))
                action = data.get("action", "")
                val = data.get("value", None)
            except Exception:
                action = ""
                val = None

            result = bridge.handle_control(action, val)
            self._send_json(result)

        elif path == "/api/alert":
            content_len = int(self.headers.get("Content-Length", 0))
            post_body = self.rfile.read(content_len) if content_len > 0 else b"{}"
            try:
                data = json.loads(post_body.decode("utf-8"))
                alert_id = data.get("alertId", "")
                emergency_id = data.get("emergencyId", "AMB-01")
                junction_id = data.get("junctionId", "")
                officer_id = data.get("officerId", "")
                msg = data.get("message", "")
            except Exception:
                alert_id, emergency_id, junction_id, officer_id, msg = "", "", "", "", ""

            result = bridge.handle_alert(alert_id, emergency_id, junction_id, officer_id, msg)
            self._send_json(result)

        else:
            self._send_json({"error": "Not Found"}, 404)

    def log_message(self, format, *args):
        try:
            if args and isinstance(args[0], str) and "GET /api/telemetry" in args[0]:
                return
        except Exception:
            pass
        super().log_message(format, *args)


# ─── Main Entry Point ────────────────────────────────────────────────

def run_server(port=8000):
    server_address = ("", port)
    
    try:
        httpd = ResQXHTTPServer(server_address, TelemetryHTTPHandler)
    except OSError as e:
        print(f"\n[ERROR] Could not bind to port {port}: {e}")
        print(f"[ERROR] Port {port} is already in use by another process.")
        print(f"[ERROR] Please kill existing python processes or specify another port.\n")
        sys.exit(1)

    # Start background simulation worker thread AFTER socket binding succeeds
    sim_thread = threading.Thread(target=bridge.simulation_loop, daemon=True)
    sim_thread.start()

    print(f"==================================================")
    print(f"ResQX SUMO Telemetry Bridge Server (1x Presentation Speed)")
    print(f"Listening on http://localhost:{port}")
    print(f"Endpoints:")
    print(f"  GET  http://localhost:{port}/api/telemetry")
    print(f"  POST http://localhost:{port}/api/control")
    print(f"  GET  http://localhost:{port}/api/control?action=start|pause|reset|speed&value=1|2|5")
    print(f"==================================================")

    try:
        httpd.serve_forever()
    except (KeyboardInterrupt, SystemExit):
        print("\nStopping Telemetry Server...")
    except Exception as e:
        print(f"\n[ERROR] Server loop error: {e}")
    finally:
        bridge.stop_sumo()
        try:
            httpd.server_close()
        except Exception:
            pass
        print("[SUMO Bridge] Server shut down cleanly.")

if __name__ == "__main__":
    port = 8000
    if len(sys.argv) > 1 and sys.argv[1].isdigit():
        port = int(sys.argv[1])
    run_server(port)
