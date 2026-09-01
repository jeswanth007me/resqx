/**
 * ResQX Master Engine Test Suite Runner
 * Executes Dijkstra Routing, Ambulance ETA, Corridor Planner, Safety Validator, and Queue Intelligence tests.
 */

console.log('>>> 1/5: RUNNING DIJKSTRA ROUTING TESTS...\n');
await import('./dijkstra.test.ts');

console.log('\n>>> 2/5: RUNNING AMBULANCE ETA TESTS...\n');
await import('./eta.test.ts');

console.log('\n>>> 3/5: RUNNING EMERGENCY CORRIDOR & GREEN-WAVE TESTS...\n');
await import('./corridor.test.ts');

console.log('\n>>> 4/5: RUNNING SAFETY VALIDATOR & CONTROL CLOSED-LOOP TESTS...\n');
await import('../../safety/tests/safety.test.ts');

console.log('\n>>> 5/5: RUNNING QUEUE-AWARE TRAFFIC INTELLIGENCE TESTS...\n');
await import('../../traffic/tests/queue.test.ts');
