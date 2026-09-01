/**
 * ResQX Master Engine Test Suite Runner
 * Executes Dijkstra Routing, Ambulance ETA, Corridor Planner, and Safety Validator tests.
 */

console.log('>>> 1/4: RUNNING DIJKSTRA ROUTING TESTS...\n');
await import('./dijkstra.test.ts');

console.log('\n>>> 2/4: RUNNING AMBULANCE ETA TESTS...\n');
await import('./eta.test.ts');

console.log('\n>>> 3/4: RUNNING EMERGENCY CORRIDOR & GREEN-WAVE TESTS...\n');
await import('./corridor.test.ts');

console.log('\n>>> 4/4: RUNNING SAFETY VALIDATOR & CONTROL CLOSED-LOOP TESTS...\n');
await import('../../safety/tests/safety.test.ts');
