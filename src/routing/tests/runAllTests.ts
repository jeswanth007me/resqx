/**
 * ResQX Master Engine Test Suite Runner
 * Executes Dijkstra Routing, Ambulance ETA, Corridor Planner, Safety Validator,
 * Queue Intelligence, Traffic Police Coordination, Experimental Benchmarking,
 * and 2D Tactical View tests.
 */

console.log('>>> 1/8: RUNNING DIJKSTRA ROUTING TESTS...\n');
await import('./dijkstra.test.ts');

console.log('\n>>> 2/8: RUNNING AMBULANCE ETA TESTS...\n');
await import('./eta.test.ts');

console.log('\n>>> 3/8: RUNNING EMERGENCY CORRIDOR & GREEN-WAVE TESTS...\n');
await import('./corridor.test.ts');

console.log('\n>>> 4/8: RUNNING SAFETY VALIDATOR & CONTROL CLOSED-LOOP TESTS...\n');
await import('../../safety/tests/safety.test.ts');

console.log('\n>>> 5/8: RUNNING QUEUE-AWARE TRAFFIC INTELLIGENCE TESTS...\n');
await import('../../traffic/tests/queue.test.ts');

console.log('\n>>> 6/8: RUNNING TRAFFIC POLICE COORDINATION & ALERT TESTS...\n');
await import('../../services/tests/police.test.ts');

console.log('\n>>> 7/8: RUNNING EXPERIMENTAL BENCHMARKING TESTS...\n');
await import('../../benchmarking/tests/benchmark.test.ts');

console.log('\n>>> 8/8: RUNNING 2D TACTICAL COMMAND-CENTER TESTS...\n');
await import('../../components/tests/tacticalView.test.ts');
