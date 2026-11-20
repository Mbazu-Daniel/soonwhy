import { Request } from "express";

export interface TenantRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string | null;
    image?: string | null;
    emailVerified: boolean;
  };
  orgId?: string;
  userRole?: string;
}
