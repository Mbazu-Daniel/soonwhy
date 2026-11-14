import { createDocument } from "zod-openapi";
import { authPaths } from "./auth-paths";

export const apiDocument = createDocument({
  openapi: "3.1.0",
  info: {
    title: "Soonwhy API",
    version: process.env.npm_package_version ?? "1.0.0",
    description:
      "OpenTelemetry-native observability: ingestion, query, detections, AI root-cause analysis and alerting. Routes are prefixed with `/api/v1`; organization-scoped routes live under `/api/v1/organization/:organizationId`. This spec currently documents the Auth surface; more modules are registered incrementally.",
    contact: { name: "Soonwhy" },
  },
  servers: [
    {
      url: process.env.OPENAPI_SERVER_URL ?? "http://localhost:8080",
      description: "This instance",
    },
  ],
  tags: [
    { name: "Auth", description: "Email/password and social sign-in, sessions." },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "Session token issued by sign-in/sign-up.",
      },
    },
  },
  paths: {
    ...authPaths,
  },
});
