export interface HostMetricsBucket {
  bucket: string;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  network_in_bytes: number;
  network_out_bytes: number;
}

export interface HostLevelBucket {
  key_as_string?: string;
  by_name?: {
    buckets?: Array<{ key: string; average?: { value?: number | null } }>;
  };
}

export interface HostTrafficBucket {
  key_as_string?: string;
  total?: { value?: number | null };
}

export interface HostMetricsResults {
  levels: HostLevelBucket[];
  received: HostTrafficBucket[];
  transmitted: HostTrafficBucket[];
}
