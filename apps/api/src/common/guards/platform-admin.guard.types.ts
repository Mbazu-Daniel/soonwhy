import type { PLATFORM_ROLE } from "./platform-admin.guard.constants";

export type PlatformRole = (typeof PLATFORM_ROLE)[keyof typeof PLATFORM_ROLE];
