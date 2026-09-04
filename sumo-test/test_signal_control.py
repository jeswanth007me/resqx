#!/usr/bin/env python3
"""
ResQX Phase 2 -- SUMO/TraCI Signal Control Verification

Honest verification chain:

    HTTP /api/signal  ->  telemetry_server.py  ->  its TraCI connection
                                                       ->  SUMO
                                                        <- telemetry /api/telemetry
                                                       (read by this test)

The bridge server owns the only TraCI client. This test does NOT open a
second TraCI client to the same SUMO process (that would be a second
client pretending to be "independent"). SUMO state is observed through
the bridge's own /api/telemetry endpoint, which exposes the bridge's
live traci.trafficlight.getRedYellowGreenState() values.

For each of SIG-01, SIG-02, SIG-03, SIG-04 the test:

  1. Reads the current SUMO state via /api/telemetry.
  2. Sends PRIORITY command via /api/signal?state=PRIORITY&pattern=GGGrr.
  3. Confirms HTTP 200 and that the JSON body reports status="ok".
  4. Waits 2s and re-reads /api/telemetry -- confirms state is STILL GGGrr.
     This catches the phase-rotation bug where setRedYellowGreenState is
     overwritten by the next SUMO cycle.
  5. Sends RESTORING command via /api/signal?state=RESTORING&pattern=yyyrr.
  6. Confirms HTTP 200.
  7. Records PASS / FAIL.

Final output for each signal is in the format:

  SIG-0N
    HTTP PRIORITY: <code>
    Telemetry SUMO state: <pattern>
    Hold test (2s):     PASS|FAIL
    HTTP RESTORING: <code>
"""

import sys
import os
import time
import subprocess
import http.client
import json

# ── Constants ───────────────────────────────────────────────────────────
SERVER_HOST = "localhost"
SERVER_PORT = 8000
SIGNALS = ["SIG-01", "SIG-02", "SIG-03", "SIG-04"]
PRIORITY_PATTERN = "GGGrr"
RESTORE_PATTERN  = "yyyrr"
HOLD_SECONDS     = 2.0   # must stay GGGrr for this long to pass hold test
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


# ── HTTP helper ─────────────────────────────────────────────────────────
def http_get(path: str) -> tuple[int, str]:
    """GET a path on the local bridge. Returns (status_code, body)."""
    try:
        conn = http.client.HTTPConnection(SERVER_HOST, SERVER_PORT, timeout=5)
        conn.request("GET", path)
        resp = conn.getresponse()
        body = resp.read().decode("utf-8")
        conn.close()
        return resp.status, body
    except Exception as e:
        return 0, str(e)


def _sigs_from(body: str) -> dict:
    """Parse signals list from telemetry JSON body."""
    try:
        return {s["id"]: s for s in json.loads(body).get("signals", [])}
    except Exception:
        return {}


# ── Test entry point ────────────────────────────────────────────────────
def run_tests() -> int:
    print("=" * 68)
    print("ResQX Phase 2 -- SUMO/TraCI Signal Control Verification")
    print("Chain: HTTP /api/signal -> bridge TraCI -> SUMO -> telemetry")
    print("=" * 68)
    print()

    # Start the bridge server
    print("[boot] Starting telemetry_server.py ...")
    server_proc = subprocess.Popen(
        [sys.executable, "telemetry_server.py"],
        cwd=SCRIPT_DIR,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    print(f"[boot] server PID = {server_proc.pid}")

    try:
        # Wait for server to come up
        deadline = time.time() + 20.0
        while time.time() < deadline:
            status, _ = http_get("/api/telemetry")
            if status == 200:
                break
            time.sleep(0.5)
        else:
            print("[FAIL] Server did not respond within 20s.")
            return 1
        print("[boot] Server responding to /api/telemetry.")

        # Tell the server to start SUMO
        status, body = http_get("/api/control?action=start")
        print(f"[boot] /api/control?action=start -> HTTP {status}  body={body}")
        if status != 200:
            print("[FAIL] Bridge refused to start SUMO.")
            return 1

        # Let the bridge spin up TraCI and post a first telemetry frame
        time.sleep(2.0)

        # Per-signal test loop
        results = []

        for sig in SIGNALS:
            print()
            print(f"[test] === {sig} ===")

            # 1. Baseline
            status, body = http_get("/api/telemetry")
            baseline = "?"
            if status == 200:
                baseline = _sigs_from(body).get(sig, {}).get("state", "?")
            print(f"  baseline (HTTP telemetry): {baseline}")

            # 2. PRIORITY command
            status, body = http_get(
                f"/api/signal?signalId={sig}&state=PRIORITY&pattern={PRIORITY_PATTERN}"
            )
            http_priority_ok = (status == 200 and '"ok"' in body)
            print(f"  HTTP PRIORITY: {status}   body_status={_extract_status(body)}")

            # 3. Wait 0.6s for bridge to push command and telemetry loop to publish
            time.sleep(0.6)

            # 4. Immediate state check
            _, body = http_get("/api/telemetry")
            sigs = _sigs_from(body)
            immediate_state = sigs.get(sig, {}).get("state", "?")
            immediate_ok = (immediate_state == PRIORITY_PATTERN)
            print(f"  Telemetry SUMO state (immediate): {immediate_state}")

            # 5. HOLD TEST: wait HOLD_SECONDS and verify state is STILL PRIORITY_PATTERN
            #    This catches phase-rotation where SUMO cycles from GGGrr to yyyrr etc.
            time.sleep(HOLD_SECONDS)
            _, body = http_get("/api/telemetry")
            sigs = _sigs_from(body)
            held_state = sigs.get(sig, {}).get("state", "?")
            hold_ok = (held_state == PRIORITY_PATTERN)
            print(f"  Telemetry SUMO state (after {HOLD_SECONDS}s hold): {held_state}")
            print(f"  Hold test: {'PASS' if hold_ok else 'FAIL'}")

            # 6. RESTORING command
            status_r, body_r = http_get(
                f"/api/signal?signalId={sig}&state=RESTORING&pattern={RESTORE_PATTERN}"
            )
            http_restore_ok = (status_r == 200 and '"ok"' in body_r)
            print(f"  HTTP RESTORING: {status_r}   body_status={_extract_status(body_r)}")

            time.sleep(0.4)
            _, body = http_get("/api/telemetry")
            after_restore = _sigs_from(body).get(sig, {}).get("state", "?")
            print(f"  Telemetry state after RESTORING: {after_restore}")

            results.append({
                "signal": sig,
                "http_priority_ok": http_priority_ok,
                "immediate_state": immediate_state,
                "immediate_ok": immediate_ok,
                "hold_state": held_state,
                "hold_ok": hold_ok,
                "http_restore_ok": http_restore_ok,
                "after_restore": after_restore,
            })

        # ── Summary ───────────────────────────────────────────────────
        print()
        print("=" * 68)
        print("RESULTS")
        print("=" * 68)
        all_pass = True
        for r in results:
            ok = r["http_priority_ok"] and r["immediate_ok"] and r["hold_ok"] and r["http_restore_ok"]
            all_pass = all_pass and ok
            status_line = "PASS" if ok else "FAIL"
            print(f"  {r['signal']}")
            print(f"    HTTP PRIORITY:           {r['http_priority_ok']}")
            print(f"    Immediate state:          {r['immediate_state']}")
            print(f"    Immediate test:            {'PASS' if r['immediate_ok'] else 'FAIL'}")
            print(f"    Hold state ({HOLD_SECONDS}s):  {r['hold_state']}")
            print(f"    Hold test:                 {status_line}")
            print(f"    HTTP RESTORING:            {r['http_restore_ok']}")
            print(f"    Telemetry after restore:  {r['after_restore']}")
            print()
        if all_pass:
            print("ALL 4 SIGNALS: PASS")
        else:
            print("VERIFICATION INCOMPLETE -- see FAIL entries above.")
        print("=" * 68)
        return 0 if all_pass else 1
    finally:
        # Tear down the bridge
        print()
        print("[teardown] Stopping telemetry_server.py ...")
        try:
            server_proc.terminate()
            server_proc.wait(timeout=5)
        except Exception:
            try:
                server_proc.kill()
            except Exception:
                pass
        print("[teardown] Done.")


def _extract_status(body: str) -> str:
    """Pull the "status" field out of a JSON body for display."""
    try:
        return json.loads(body).get("status", "?")
    except Exception:
        return "?"


if __name__ == "__main__":
    sys.exit(run_tests())
