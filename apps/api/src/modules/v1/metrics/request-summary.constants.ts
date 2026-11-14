export const ERROR_STATUS_FLOOR = 400;
export const HEALTH_ERROR_WEIGHT = 10;
export const HEALTH_LATENCY_DIVISOR = 100;
export const OVERVIEW_BUCKET_TARGET = 24;
export const MAX_SERVICES = 100;
export const STATUS_RANGES = [
  { from: 200, to: 300, key: "2xx" },
  { from: 300, to: 400, key: "3xx" },
  { from: 400, to: 500, key: "4xx" },
  { from: 500, key: "5xx" },
];
