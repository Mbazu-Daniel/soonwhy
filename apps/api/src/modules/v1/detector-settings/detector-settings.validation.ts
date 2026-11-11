import { z } from "zod";
import {
  DETECTOR_DEFINITIONS,
  DETECTOR_THRESHOLD_KEYS,
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAG_DEFINITIONS,
  FEATURE_FLAG_KEYS,
  DETECTOR_KEYS,
  type DetectorConfigInput,
} from "./detector-settings.constants";

export type DetectorFeatureFlags = Record<string, boolean>;

export type DetectorSettingsSnapshot = {
  organizationId: string;
  detectors: Record<string, { enabled: boolean; thresholds: Record<string, number> }>;
  featureFlags: DetectorFeatureFlags;
  overrides: {
    detectors: Record<string, DetectorConfigInput>;
    featureFlags: Record<string, boolean>;
  };
  knownDetectors: typeof DETECTOR_DEFINITIONS;
  knownFeatureFlags: typeof FEATURE_FLAG_DEFINITIONS;
  updatedAt?: string;
};

export type DetectorSettingsPatch = {
  detectors?: Record<string, DetectorConfigInput>;
  featureFlags?: Record<string, boolean>;
};

const thresholdSchema = z
  .number()
  .finite()
  .min(-1_000_000_000_000)
  .max(1_000_000_000_000);

const detectorConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    thresholds: z.record(thresholdSchema).optional(),
  })
  .strict();

const detectorOverridesSchema = z
  .record(z.enum(DETECTOR_KEYS as [string, ...string[]]), detectorConfigSchema)
  .superRefine((overrides, context) => {
    for (const [detector, config] of Object.entries(overrides)) {
      const allowed = new Set(DETECTOR_THRESHOLD_KEYS[detector] ?? []);
      for (const threshold of Object.keys(config.thresholds ?? {})) {
        if (!allowed.has(threshold)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [detector, "thresholds", threshold],
            message: `threshold ${threshold} is not supported for ${detector}`,
          });
        }
      }
    }
  });

const featureFlagSchema = z.record(
  z.enum(FEATURE_FLAG_KEYS as [string, ...string[]]),
  z.boolean(),
);

const detectorSettingsPatchSchema = z
  .object({
    detectors: detectorOverridesSchema.optional(),
    featureFlags: featureFlagSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.detectors === undefined && value.featureFlags === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [],
        message: "at least one of detectors or featureFlags is required",
      });
    }
  });

export function parseDetectorSettingsPatch(raw: unknown): DetectorSettingsPatch {
  return detectorSettingsPatchSchema.parse(raw);
}

export function normalizeDetectorOverrides(raw: unknown): Record<string, DetectorConfigInput> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const parsed = detectorOverridesSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export function normalizeFeatureFlags(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const parsed = featureFlagSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}

export function effectiveDetectors(
  overrides: Record<string, DetectorConfigInput>,
): Record<string, { enabled: boolean; thresholds: Record<string, number> }> {
  return Object.fromEntries(
    DETECTOR_DEFINITIONS.map((definition) => {
      const override = overrides[definition.key] ?? {};
      const thresholds = Object.fromEntries(
        Object.entries(override.thresholds ?? {}).filter(
          ([key, value]) =>
            definition.thresholdKeys.includes(key) &&
            Number.isFinite(value) &&
            Number.isFinite(Number(value)),
        ),
      );
      return [
        definition.key,
        {
          enabled: override.enabled !== false,
          thresholds,
        },
      ];
    }),
  );
}

const ENV_BOOLEAN = new Set(["1", "true", "yes", "on"]);
const ENV_DISABLED = new Set(["0", "false", "no", "off"]);

function environmentFlag(key: string, env: NodeJS.ProcessEnv = process.env) {
  const name = `SOONWHY_${key.toUpperCase().replace(/\./g, "_")}`;
  const raw = env[name];
  if (raw === undefined) return undefined;
  const normalized = raw.trim().toLowerCase();
  if (ENV_BOOLEAN.has(normalized)) return true;
  if (ENV_DISABLED.has(normalized)) return false;
  return undefined;
}

export function effectiveFeatureFlags(
  overrides: Record<string, boolean>,
  env: NodeJS.ProcessEnv = process.env,
): Record<string, boolean> {
  return Object.fromEntries(
    FEATURE_FLAG_DEFINITIONS.map((definition) => {
      const global = environmentFlag(definition.key, env);
      // An explicit environment disable is an operator override and cannot be
      // re-enabled from the UI. Otherwise organisation preferences win over defaults.
      const value = global === false
        ? false
        : overrides[definition.key] ?? global ?? DEFAULT_FEATURE_FLAGS[definition.key];
      return [definition.key, value !== false];
    }),
  );
}

export function isFeatureEnabled(
  flags: Record<string, boolean>,
  key: string,
): boolean {
  return flags[key] !== false;
}

export function isDetectorEnabled(
  detectors: Record<string, { enabled: boolean }>,
  key: string,
): boolean {
  return detectors[key]?.enabled !== false;
}

export function thresholdOverride(
  detectors: Record<string, { thresholds: Record<string, number> }>,
  detector: string,
  key: string,
): number | undefined {
  const value = detectors[detector]?.thresholds?.[key];
  return Number.isFinite(value) ? value : undefined;
}

export function mergeDetectorOverrides(
  existing: Record<string, DetectorConfigInput>,
  patch: Record<string, DetectorConfigInput> | undefined,
): Record<string, DetectorConfigInput> {
  if (!patch) return existing;
  const merged: Record<string, DetectorConfigInput> = { ...existing };
  for (const [detector, config] of Object.entries(patch)) {
    const current = merged[detector] ?? {};
    merged[detector] = {
      ...(config.enabled !== undefined || current.enabled !== undefined
        ? { enabled: config.enabled ?? current.enabled }
        : {}),
      ...(config.thresholds !== undefined || current.thresholds !== undefined
        ? {
            thresholds: {
              ...(current.thresholds ?? {}),
              ...(config.thresholds ?? {}),
            },
          }
        : {}),
    };
    if (merged[detector]?.enabled === undefined) delete merged[detector]?.enabled;
    if (merged[detector]?.thresholds && Object.keys(merged[detector].thresholds!).length === 0) {
      delete merged[detector]?.thresholds;
    }
  }
  return merged;
}
