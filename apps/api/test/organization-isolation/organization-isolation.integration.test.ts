import { closeDatabase, databaseTestsEnabled, describeOrganizationIsolation, resetDatabase } from "@soonwhy/test-support";
import { apiKeyResource } from "./api-keys.resource";
import { chatThreadResource } from "./chat-threads.resource";
import { dlqResource } from "./dlq.resource";
import { incidentResource } from "./incidents.resource";
import { findingResource } from "./findings.resource";
import { probeResource } from "./probes.resource";
import { projectSettingsResource } from "./project-settings.resource";
import { projectResource } from "./projects.resource";
import { serviceAccountKeyResource } from "./service-account-keys.resource";
import { serviceResource } from "./services-catalog.resource";
import { createTestOrganization } from "./support";
import type { TestOrganization } from "./types";

describeOrganizationIsolation<TestOrganization>({
  name: "API repositories and services",
  enabled: databaseTestsEnabled,
  reset: resetDatabase,
  close: closeDatabase,
  createOrganization: createTestOrganization,
  resources: [projectResource, projectSettingsResource, apiKeyResource, findingResource, incidentResource, probeResource, serviceResource, serviceAccountKeyResource, chatThreadResource, dlqResource],
});
