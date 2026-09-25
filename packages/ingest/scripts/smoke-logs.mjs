#!/usr/bin/env node
/**
 * Smoke: POST OTLP JSON log → wait → optional GET /api/v1/logs
 *
 * Env:
 *   INGEST_URL (default http://localhost:3002)
 *   API_URL (default http://localhost:3001)
 *   SOONWHY_API_KEY
 *   ORG_ID
 *   PROJECT_ID
 */
const ingestUrl = process.env.INGEST_URL || 'http://localhost:3002';
const apiUrl = process.env.API_URL || 'http://localhost:3001';
const apiKey = process.env.SOONWHY_API_KEY;
const orgId = process.env.ORG_ID;
const projectId = process.env.PROJECT_ID;

if (!apiKey) {
  console.error('SOONWHY_API_KEY is required');
  process.exit(1);
}

const nowNano = String(BigInt(Date.now()) * 1_000_000n);
const message = `otlp-smoke-${Date.now()}`;

const payload = {
  resourceLogs: [
    {
      resource: {
        attributes: [{ key: 'service.name', value: { stringValue: 'smoke-test' } }],
      },
      scopeLogs: [
        {
          logRecords: [
            {
              timeUnixNano: nowNano,
              severityNumber: 9,
              severityText: 'INFO',
              body: { stringValue: message },
              attributes: [],
            },
          ],
        },
      ],
    },
  ],
};

const res = await fetch(`${ingestUrl}/api/v1/logs`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  },
  body: JSON.stringify(payload),
});

const body = await res.text();
console.log('ingest status', res.status, body);
if (!res.ok) process.exit(1);

if (orgId && projectId) {
  await new Promise((r) => setTimeout(r, 3000));
  const q = new URLSearchParams({ projectId, q: message });
  const queryRes = await fetch(`${apiUrl}/api/v1/logs?${q}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'X-Org-Id': orgId,
    },
  });
  const queryBody = await queryRes.text();
  console.log('query status', queryRes.status, queryBody.slice(0, 500));
  if (!queryRes.ok || !queryBody.includes(message)) {
    console.error('Smoke query did not find ingested log');
    process.exit(1);
  }
}

console.log('smoke ok');
