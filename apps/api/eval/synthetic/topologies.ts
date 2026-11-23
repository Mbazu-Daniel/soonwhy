import type { Step, Topology } from "./types";

const seq = (...targets: string[]): Step => ({ calls: targets.map((target) => ({ target })), parallel: false });
const par = (...targets: string[]): Step => ({ calls: targets.map((target) => ({ target })), parallel: true });

export const SIX_SERVICES: Topology = {
  name: "six",
  entry: "gateway",
  services: {
    gateway: { work: 5, steps: [seq("orders")] },
    orders: { work: 8, steps: [par("inventory", "payments"), seq("db")] },
    inventory: { work: 10, steps: [seq("db")] },
    payments: { work: 12, steps: [seq("fraud")] },
    fraud: { work: 20, steps: [] },
    db: { work: 15, steps: [] },
  },
  targets: ["db", "fraud", "inventory"],
  pairs: [["fraud", "inventory"], ["payments", "inventory"], ["fraud", "db"]],
};

export const TWELVE_SERVICE_CHAIN: Topology = {
  name: "chain12",
  entry: "gateway",
  services: {
    gateway: { work: 5, steps: [seq("auth"), seq("orders")] },
    auth: { work: 5, steps: [seq("users")] },
    users: { work: 8, steps: [seq("db")] },
    orders: { work: 8, steps: [par("inventory", "payments"), seq("pricing")] },
    inventory: { work: 10, steps: [seq("warehouse")] },
    warehouse: { work: 12, steps: [seq("db")] },
    payments: { work: 12, steps: [seq("fraud")] },
    fraud: { work: 20, steps: [seq("ledger")] },
    ledger: { work: 14, steps: [seq("db")] },
    pricing: { work: 9, steps: [seq("cache")] },
    cache: { work: 3, steps: [] },
    db: { work: 15, steps: [] },
  },
  targets: ["db", "fraud", "warehouse"],
  pairs: [["fraud", "warehouse"], ["ledger", "cache"], ["users", "pricing"]],
};

export const FAN_IN_FAN_OUT_MESH: Topology = {
  name: "mesh",
  entry: "gateway",
  services: {
    gateway: { work: 5, steps: [par("web", "mobile", "partner")] },
    web: { work: 7, steps: [par("catalog", "pricing")] },
    mobile: { work: 7, steps: [par("catalog", "pricing")] },
    partner: { work: 7, steps: [seq("catalog")] },
    catalog: { work: 10, steps: [par("search", "db")] },
    pricing: { work: 9, steps: [par("cache", "db")] },
    search: { work: 12, steps: [] },
    cache: { work: 3, steps: [] },
    db: { work: 15, steps: [] },
  },
  targets: ["db", "catalog", "search"],
  pairs: [["search", "cache"], ["search", "pricing"], ["catalog", "cache"]],
};

export const TOPOLOGIES: Topology[] = [SIX_SERVICES, TWELVE_SERVICE_CHAIN, FAN_IN_FAN_OUT_MESH];
