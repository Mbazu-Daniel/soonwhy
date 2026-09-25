const urls = (process.env.INGEST_URLS ?? process.env.INGEST_URL ?? 'http://localhost:3002').split(',').map((url) => url.trim()).filter(Boolean);
const apiKey = process.env.SOONWHY_API_KEY;
const requests = Number(process.env.LOAD_REQUESTS ?? 1000);
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? 50);
const payload = JSON.stringify({ resourceSpans: [{ resource: { attributes: [{ key: 'service.name', value: { stringValue: 'load-test' } }] }, scopeSpans: [{ spans: [{ name: 'load-test', traceId: '00000000000000000000000000000001', spanId: '0000000000000001' }] }] }] });

if (!apiKey) throw new Error('SOONWHY_API_KEY is required');
if (!urls.length) throw new Error('INGEST_URL or INGEST_URLS must contain at least one URL');
if (!Number.isInteger(requests) || requests <= 0) throw new Error('LOAD_REQUESTS must be a positive integer');
if (!Number.isInteger(concurrency) || concurrency <= 0) throw new Error('LOAD_CONCURRENCY must be a positive integer');

let next = 0; let completed = 0; let success = 0; let rateLimited = 0; let overloaded = 0; let failed = 0;
const latencies = [];
const byUrl = new Map(urls.map((url) => [url, { success: 0, rateLimited: 0, overloaded: 0, failed: 0 }]));

async function worker() {
  while (true) {
    const index = next++;
    if (index >= requests) return;
    const baseUrl = urls[index % urls.length];
    const stats = byUrl.get(baseUrl);
    const started = performance.now();
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/v1/traces`, {
        method: 'POST',
        headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
        body: payload,
      });
      latencies.push(performance.now() - started);
      if (response.ok) { success++; stats.success++; }
      else if (response.status === 429) { rateLimited++; stats.rateLimited++; }
      else if (response.status === 503) { overloaded++; stats.overloaded++; }
      else { failed++; stats.failed++; }
    } catch { failed++; stats.failed++; }
    finally { completed++; if (completed % 100 === 0 || completed === requests) process.stdout.write(`\rcompleted=${completed}/${requests}`); }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, requests) }, worker));
process.stdout.write('\n');
latencies.sort((a, b) => a - b);
const percentile = (p) => latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * p))] : 0;
console.log(JSON.stringify({ targetCount: urls.length, urlCount: urls.length, urls, requests, concurrency, success, rateLimited, overloaded, failed, byUrl: Object.fromEntries(byUrl), p50Ms: Number(percentile(0.5).toFixed(2)), p95Ms: Number(percentile(0.95).toFixed(2)), p99Ms: Number(percentile(0.99).toFixed(2)) }, null, 2));
if (failed > 0) process.exitCode = 1;
