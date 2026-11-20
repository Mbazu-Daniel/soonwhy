import { fork, type ChildProcess } from "node:child_process";
import { readFileSync } from "node:fs";
import http from "node:http";
import type { SpanRecord } from "./types";

export const SERVICES = ["gateway", "orders", "inventory", "payments", "fraud", "db"] as const;
export type ServiceName = (typeof SERVICES)[number];
const BASE_PORT = 4101;
const PORTS = Object.fromEntries(SERVICES.map((s, i) => [s, BASE_PORT + i]));

export interface Fault {
  delayMs?: number;
  errorRate?: number;
  spinMs?: number;
}

export class Cluster {
  private children = new Map<ServiceName, ChildProcess>();
  onSpan: (span: SpanRecord) => void = () => {};

  async start(): Promise<void> {
    const entry = new URL("./service.mjs", import.meta.url).pathname;
    await Promise.all(
      SERVICES.map(
        (service) =>
          new Promise<void>((resolve, reject) => {
            const child = fork(entry, [], {
              env: { ...process.env, SERVICE: service, PORT: String(PORTS[service]), PORTS: JSON.stringify(PORTS) },
              stdio: ["ignore", "inherit", "inherit", "ipc"],
            });
            child.on("message", (msg: { type: string } & Partial<SpanRecord>) => {
              if (msg.type === "span") this.onSpan(msg as SpanRecord);
              if (msg.type === "ready") resolve();
            });
            child.on("error", reject);
            this.children.set(service, child);
          }),
      ),
    );
  }

  pids(): number[] {
    return [...this.children.values()].map((c) => c.pid!).filter(Boolean);
  }

  cpuSeconds(): number {
    let ticks = 0;
    for (const pid of this.pids()) {
      const stat = readFileSync(`/proc/${pid}/stat`, "utf8");
      const fields = stat.slice(stat.lastIndexOf(")") + 2).split(" ");
      ticks += Number(fields[11]) + Number(fields[12]);
    }
    return ticks / 100;
  }

  rssMb(): number {
    let kb = 0;
    for (const pid of this.pids()) {
      const m = /VmRSS:\s+(\d+)/.exec(readFileSync(`/proc/${pid}/status`, "utf8"));
      kb += m ? Number(m[1]) : 0;
    }
    return kb / 1024;
  }

  async setFault(service: ServiceName, fault: Fault): Promise<void> {
    const child = this.children.get(service)!;
    await new Promise<void>((resolve) => {
      const handler = (msg: { type: string }) => {
        if (msg.type === "fault-ack") {
          child.off("message", handler);
          resolve();
        }
      };
      child.on("message", handler);
      child.send({ type: "fault", fault });
    });
  }

  async reset(seed: number): Promise<void> {
    await Promise.all(SERVICES.map((s) => this.setFault(s, {})));
    SERVICES.forEach((s, i) => this.children.get(s)!.send({ type: "seed", seed: seed * 31 + i }));
  }

  stop(): void {
    for (const child of this.children.values()) child.kill("SIGKILL");
  }
}

const agent = new http.Agent({ keepAlive: true, maxSockets: 64 });

export function request(): Promise<{ ms: number; ok: boolean }> {
  const t = performance.now();
  return new Promise((resolve) => {
    const req = http.request({ host: "127.0.0.1", port: BASE_PORT, path: "/", agent }, (res) => {
      res.resume();
      res.on("end", () => resolve({ ms: performance.now() - t, ok: res.statusCode! < 500 }));
    });
    req.on("error", () => resolve({ ms: performance.now() - t, ok: false }));
    req.end();
  });
}

export async function closedLoop(total: number, concurrency: number): Promise<{ ms: number; ok: boolean }[]> {
  const results: { ms: number; ok: boolean }[] = [];
  let issued = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (issued < total) {
        issued += 1;
        results.push(await request());
      }
    }),
  );
  return results;
}

export async function openLoop(rps: number, seconds: number): Promise<{ ms: number; ok: boolean }[]> {
  const results: Promise<{ ms: number; ok: boolean }>[] = [];
  const total = rps * seconds;
  const start = performance.now();
  for (let i = 0; i < total; i++) {
    const wait = start + (i * 1000) / rps - performance.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    results.push(request());
  }
  return Promise.all(results);
}

export const percentile = (xs: number[], p: number) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * p))]! : 0;
};
