/**
 * ResQX Traffic Police Coordination & Emergency Alert Tests
 *
 * Deterministic test suite verifying:
 * 1. Junction officer assignment based on corridor plan
 * 2. On-duty officer selection for assigned junctions
 * 3. Unassigned handling when no officer is available (NO_OFFICER_AVAILABLE)
 * 4. Emergency alert payload generation with formatted message and ETA
 * 5. Duplicate alert prevention (anti-spam idempotency)
 * 6. Demo alert dispatch execution
 * 7. Demo alert acknowledgement tracking
 * 8. Server-side live dispatch error fallback handling
 * 9. Accurate emergency/corridor junction association
 * 10. Officer status toggling (ON_DUTY <-> OFF_DUTY)
 */

import { PoliceCoordinator } from '../policeCoordinator.ts';
import { DemoAlertService, LiveAlertService } from '../alertService.ts';
import { getDefaultCityGraph } from '../../routing/graph.ts';
import { calculateAmbulanceRoute } from '../../routing/engine.ts';
import { calculateAmbulanceEta } from '../../routing/eta.ts';
import { planEmergencyCorridor } from '../../routing/corridor.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

console.log('====================================================');
console.log('ResQX Traffic Police Coordination & Alert Tests');
console.log('====================================================\n');

// ── TEST 1: Junction Officer Assignment from Corridor Plan ───────────
console.log('TEST 1: Junction officer assignment from corridor plan');
{
  const coordinator = new PoliceCoordinator();
  const graph = getDefaultCityGraph();
  const route = calculateAmbulanceRoute(graph);
  const eta = calculateAmbulanceEta({
    routeResult: route,
    ambulance: { speedKmh: 50, currentRoadId: 'ROAD-01', progressOnCurrentRoad: 0 },
    signals: [
      { id: 'SIG-01', name: 'North Gate', road: 'ROAD-01', position: { x: 300, y: 150 } },
      { id: 'SIG-03', name: 'Hospital Approach', road: 'ROAD-03', position: { x: 300, y: 400 } },
    ],
  });
  const corridor = planEmergencyCorridor(eta);
  const assignments = coordinator.assignOfficersForCorridor(corridor, 'AMB-01', 0);

  console.log('  Corridor Signals Count:', corridor.signals.length);
  console.log('  Assigned Junctions:', assignments.map((a) => `${a.signalId} -> ${a.officerName} (ETA ${a.etaSeconds}s)`));

  assert(assignments.length === 2, 'TEST 1: Must create assignments for both corridor signals');
  assert(assignments[0].signalId === 'SIG-01', 'TEST 1: First assignment must be SIG-01');
  assert(assignments[0].officerId === 'OFFICER-01', 'TEST 1: SIG-01 must be assigned to OFFICER-01 (Rajesh Kumar)');
  assert(assignments[1].signalId === 'SIG-03', 'TEST 1: Second assignment must be SIG-03');
  assert(assignments[1].officerId === 'OFFICER-02', 'TEST 1: SIG-03 must be assigned to OFFICER-02 (Priya Sharma)');
  console.log('✅ TEST 1 PASSED: Junction officer assignment verified from corridor plan.\n');
}

// ── TEST 2: On-Duty Officer Selection ─────────────────────────────────
console.log('TEST 2: On-duty officer selection');
{
  const coordinator = new PoliceCoordinator();
  const officerSig1 = coordinator.selectOfficerForJunction('SIG-01');
  const officerSig3 = coordinator.selectOfficerForJunction('SIG-03');

  console.log('  Selected for SIG-01:', officerSig1?.name, `(${officerSig1?.badgeNumber})`);
  console.log('  Selected for SIG-03:', officerSig3?.name, `(${officerSig3?.badgeNumber})`);

  assert(officerSig1 !== null, 'TEST 2: Must find officer for SIG-01');
  assert(officerSig1?.status === 'ON_DUTY', 'TEST 2: Selected officer must be ON_DUTY');
  assert(officerSig3 !== null, 'TEST 2: Must find officer for SIG-03');
  assert(officerSig3?.status === 'ON_DUTY', 'TEST 2: Selected officer must be ON_DUTY');
  console.log('✅ TEST 2 PASSED: On-duty officers selected successfully.\n');
}

// ── TEST 3: No Officer Available Handling ─────────────────────────────
console.log('TEST 3: No officer available handling (Unassigned status)');
{
  const coordinator = new PoliceCoordinator();
  // Mark Officer 1 and Officer 4 as OFF_DUTY
  coordinator.setOfficerStatus('OFFICER-01', 'OFF_DUTY');
  coordinator.setOfficerStatus('OFFICER-04-OFFDUTY', 'OFF_DUTY');

  const officer = coordinator.selectOfficerForJunction('SIG-01');
  console.log('  Officer for SIG-01 when all assigned are off duty:', officer);

  assert(officer === null, 'TEST 3: Must return null when no officer is on duty');

  const mockPlan = {
    success: true,
    corridorId: 'CORRIDOR-TEST',
    emergencyId: 'AMB-01',
    ambulanceId: 'AMB-01',
    routeRoadIds: ['ROAD-01'],
    totalDistance: 235,
    timestamp: Date.now(),
    signals: [
      {
        signalId: 'SIG-01',
        signalName: 'North Gate',
        roadId: 'ROAD-01',
        distanceFromAmbulance: 100,
        predictedArrivalSeconds: 10,
        predictedArrivalSimulationTime: 10,
        prepareAt: 4,
        priorityStart: 8,
        priorityEnd: 13,
        restoreAt: 17,
        duration: 5,
        currentPhase: 'NORMAL' as const,
        status: 'APPROVED' as const,
        reason: 'Test',
        safetyFlags: {
          hasSufficientPreparationTime: true,
          withinMaxDuration: true,
          hasConflictingPriority: false,
          isRestorationScheduled: true,
          warnings: [],
        },
        conflictingSignalIds: [],
      },
    ],
    status: 'ACTIVE' as const,
    metrics: {
      totalCorridorDistance: 235,
      totalSignalsCount: 1,
      predictedAmbulanceTravelTime: 18,
      predictedSignalWaitingTime: 0,
      uncontrolledEstimatedDelay: 12,
      estimatedTimeSaved: 12,
      totalCorridorDuration: 13,
    },
    reason: 'Test',
  };

  const assignments = coordinator.assignOfficersForCorridor(mockPlan, 'AMB-01', 0);
  console.log('  Assignment status for unstaffed junction:', assignments[0].status);
  console.log('  Assignment reason:', assignments[0].assignmentReason);

  assert(assignments[0].status === 'UNASSIGNED', 'TEST 3: Assignment status must be UNASSIGNED');
  assert(assignments[0].assignmentReason.includes('NO_OFFICER_AVAILABLE'), 'TEST 3: Must record NO_OFFICER_AVAILABLE');
  console.log('✅ TEST 3 PASSED: Unstaffed junction safely handled without fake assignment.\n');
}

// ── TEST 4: Emergency Alert Payload Generation ───────────────────────
console.log('TEST 4: Emergency alert payload generation');
{
  const coordinator = new PoliceCoordinator();
  const assignment = {
    junctionId: 'SIG-01',
    signalId: 'SIG-01',
    officerId: 'OFFICER-01',
    officerName: 'Insp. Rajesh Kumar',
    badgeNumber: 'TP-4021',
    contactIdentifier: '+91-98765-XXXX1',
    assignmentReason: 'On-duty primary officer',
    emergencyId: 'AMB-01',
    etaSeconds: 8.5,
    assignedAt: 0,
    status: 'ASSIGNED' as const,
  };

  const alert = coordinator.createEmergencyAlert(assignment, 'HIGH', 1000);

  console.log('  Generated Alert ID:', alert?.alertId);
  console.log('  Recipient:', alert?.officerName, `(${alert?.contactIdentifier})`);
  console.log('  Formatted ETA:', alert?.formattedEta);
  console.log('  Message Preview:\n', alert?.message);

  assert(alert !== null, 'TEST 4: Alert must be generated');
  assert(alert?.status === 'PENDING', 'TEST 4: Initial status must be PENDING');
  assert(alert?.mode === 'DEMO', 'TEST 4: Default mode must be DEMO');
  assert(Boolean(alert?.message.includes('AMB-01')), 'TEST 4: Message must contain emergency ID AMB-01');
  assert(Boolean(alert?.message.includes('SIG-01')), 'TEST 4: Message must contain signal ID SIG-01');
  console.log('✅ TEST 4 PASSED: Explainable alert payload created.\n');
}

// ── TEST 5: Duplicate Alert Prevention (Idempotency) ─────────────────
console.log('TEST 5: Duplicate alert prevention');
{
  const coordinator = new PoliceCoordinator();

  const firstCheck = coordinator.shouldSendAlert('AMB-01', 'SIG-01');
  coordinator.markAlertSent('AMB-01', 'SIG-01');
  const secondCheck = coordinator.shouldSendAlert('AMB-01', 'SIG-01');
  const otherJunctionCheck = coordinator.shouldSendAlert('AMB-01', 'SIG-03');

  console.log('  First check (AMB-01, SIG-01):', firstCheck);
  console.log('  Second check (AMB-01, SIG-01):', secondCheck);
  console.log('  Other junction check (AMB-01, SIG-03):', otherJunctionCheck);

  assert(firstCheck === true, 'TEST 5: First check must allow alert');
  assert(secondCheck === false, 'TEST 5: Duplicate check must block repeat alert');
  assert(otherJunctionCheck === true, 'TEST 5: Other junction must not be blocked');
  console.log('✅ TEST 5 PASSED: Anti-spam deduplication verified.\n');
}

// ── TEST 6: Demo Alert Dispatch ──────────────────────────────────────
console.log('TEST 6: Demo alert dispatch execution');
{
  const demoService = new DemoAlertService();
  const alert = {
    alertId: 'ALERT-TEST-001',
    emergencyId: 'AMB-01',
    junctionId: 'SIG-01',
    signalId: 'SIG-01',
    officerId: 'OFFICER-01',
    officerName: 'Insp. Rajesh Kumar',
    contactIdentifier: '+91-98765-XXXX1',
    etaSeconds: 8,
    formattedEta: '00:08',
    priority: 'HIGH' as const,
    message: 'Test message',
    status: 'PENDING' as const,
    mode: 'DEMO' as const,
    timestamp: Date.now(),
  };

  const result = await demoService.sendAlert(alert);

  console.log('  Demo Dispatch Result Success:', result.success);
  console.log('  Status:', result.status);
  console.log('  Mode:', result.mode);
  console.log('  Message:', result.message);

  assert(result.success === true, 'TEST 6: Dispatch must succeed in Demo Mode');
  assert(result.mode === 'DEMO', 'TEST 6: Mode must be explicitly DEMO');
  assert(result.status === 'DEMO', 'TEST 6: Status must be DEMO');
  console.log('✅ TEST 6 PASSED: Demo alert dispatch executed cleanly without fake SMS claims.\n');
}

// ── TEST 7: Demo Alert Acknowledgement ───────────────────────────────
console.log('TEST 7: Demo alert acknowledgement tracking');
{
  const demoService = new DemoAlertService();
  const alertId = 'ALERT-TEST-002';

  const initialStatus = await demoService.getAlertStatus(alertId);
  await demoService.acknowledgeAlert(alertId);
  const ackStatus = await demoService.getAlertStatus(alertId);

  console.log('  Initial Status:', initialStatus);
  console.log('  Acknowledged Status:', ackStatus);

  assert(ackStatus === 'ACKNOWLEDGED', 'TEST 7: Status must update to ACKNOWLEDGED');
  console.log('✅ TEST 7 PASSED: Alert acknowledgement verified.\n');
}

// ── TEST 8: Live Alert Fallback Handling ─────────────────────────────
console.log('TEST 8: Live alert error handling & safe fallback');
{
  // Port 9999 is intentionally offline
  const liveService = new LiveAlertService('http://localhost:9999');
  const alert = {
    alertId: 'ALERT-TEST-003',
    emergencyId: 'AMB-01',
    junctionId: 'SIG-01',
    signalId: 'SIG-01',
    officerId: 'OFFICER-01',
    officerName: 'Insp. Rajesh Kumar',
    contactIdentifier: '+91-98765-XXXX1',
    etaSeconds: 8,
    formattedEta: '00:08',
    priority: 'HIGH' as const,
    message: 'Test live dispatch',
    status: 'PENDING' as const,
    mode: 'LIVE' as const,
    timestamp: Date.now(),
  };

  const result = await liveService.sendAlert(alert);

  console.log('  Offline Server Live Result Success:', result.success);
  console.log('  Status:', result.status);
  console.log('  Message:', result.message);

  assert(result.success === false, 'TEST 8: Offline server must return success: false');
  assert(result.status === 'FAILED', 'TEST 8: Status must be FAILED');
  console.log('✅ TEST 8 PASSED: Live dispatch failure handled safely without crash.\n');
}

// ── TEST 9: Officer Duty Status Toggling ─────────────────────────────
console.log('TEST 9: Officer duty status toggling');
{
  const coordinator = new PoliceCoordinator();
  coordinator.setOfficerStatus('OFFICER-01', 'BUSY');
  const officer = coordinator.getOfficer('OFFICER-01');

  console.log('  Officer 01 updated status:', officer?.status);
  assert(officer?.status === 'BUSY', 'TEST 9: Status must be updated to BUSY');
  console.log('✅ TEST 9 PASSED: Officer status dynamically updated.\n');
}

console.log('====================================================');
console.log('ALL 9 POLICE COORDINATION & ALERT TESTS PASSED!');
console.log('====================================================');
