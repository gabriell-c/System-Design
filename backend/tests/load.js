import http from 'k6/http';
import { check, sleep } from 'k6';

/**
 * k6 load test — 3 scenarios (smoke, sustained, stress)
 * Run: k6 run tests/load.js
 */

// Smoke test: low load
export const smoke = {
  executor: 'constant-vus',
  vus: 1,
  duration: '30s',
};

// Sustained load: moderate
export const sustained = {
  executor: 'ramping-vus',
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 0 },
  ],
};

// Stress test: ramp up to peak
export const stress = {
  executor: 'ramping-vus',
  stages: [
    { duration: '10s', target: 20 },
    { duration: '30s', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '10s', target: 0 },
  ],
};

// Export default to run smoke by default
export const options = smoke;

export default function () {
  const baseUrl = 'http://127.0.0.1:8021';

  // 1. Health check (lightweight)
  const health = http.get(`${baseUrl}/api/health`);
  check(health, {
    'health is 200': (r) => r.status === 200,
    'health response time < 100ms': (r) => r.timings.duration < 100,
  });

  sleep(0.1);

  // 2. List graphs
  const graphs = http.get(`${baseUrl}/api/v1/graphs`);
  check(graphs, {
    'list graphs is 200': (r) => r.status === 200,
    'list graphs response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(0.1);

  // 3. Create graph
  const createPayload = JSON.stringify({
    name: `Load Test ${__VU}-${__ITER}`,
    nodes: [
      {
        id: 'n1',
        type: 'arch',
        position: { x: 0, y: 0 },
        data: { kind: 'backend', label: 'API', catalogId: 'be-fastapi' },
      },
    ],
    edges: [],
  });

  const createResp = http.post(`${baseUrl}/api/v1/graphs`, createPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  check(createResp, {
    'create graph is 201': (r) => r.status === 201,
    'create graph response time < 1s': (r) => r.timings.duration < 1000,
  });

  let graphId;
  if (createResp.status === 201) {
    graphId = createResp.json('id');

    sleep(0.1);

    // 4. Analyze graph
    const analyzeResp = http.post(
      `${baseUrl}/api/v1/graphs/${graphId}/analyze`,
      null,
      { headers: { 'Content-Type': 'application/json' } }
    );

    check(analyzeResp, {
      'analyze is 200': (r) => r.status === 200,
      'analyze response time < 2s': (r) => r.timings.duration < 2000,
    });

    sleep(0.1);

    // 5. Get graph
    const getResp = http.get(`${baseUrl}/api/v1/graphs/${graphId}`);
    check(getResp, {
      'get graph is 200': (r) => r.status === 200,
      'get graph response time < 500ms': (r) => r.timings.duration < 500,
    });

    sleep(0.1);

    // 6. Delete graph
    const deleteResp = http.del(`${baseUrl}/api/v1/graphs/${graphId}`);
    check(deleteResp, {
      'delete is 204': (r) => r.status === 204,
    });
  }

  sleep(1); // Pause between iterations
}
