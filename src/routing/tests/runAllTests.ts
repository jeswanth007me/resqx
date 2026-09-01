/**
 * ResQX Master Engine Test Suite Runner
 * Executes Dijkstra Routing, Ambulance ETA, Corridor Planner, Safety Validator,
 * Queue Intelligence, and Traffic Police Coordination tests.
 */

console.log('>>> 1/6: RUNNING DIJKSTRA ROUTING TESTS...\n');
await import('./dijkstra.test.ts');

console.log('\n>>> 2/6: RUNNING AMBULANCE ETA TESTS...\n');
await import('./eta.test.ts');

console.log('\n>>> 3/6: RUNNING EMERGENCY CORRIDOR & GREEN-WAVE TESTS...\n');
await import('./corridor.test.ts');

console.log('\n>>> 4/6: RUNNING SAFETY VALIDATOR & CONTROL CLOSED-LOOP TESTS...\n');
await import('../../safety/tests/safety.test.ts');

console.log('\n>>> 5/6: RUNNING QUEUE-AWARE TRAFFIC INTELLIGENCE TESTS...\n');
await import('../../traffic/tests/queue.test.ts');

console.log('\n>>> 6/6: RUNNING TRAFFIC POLICE COORDINATION & ALERT TESTS...\n');
await import('../../services/tests/police.test.ts');
