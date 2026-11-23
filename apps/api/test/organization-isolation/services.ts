import { FindingsService } from "../../src/modules/v1/detection/findings/application/findings.service";
import { FindingRepository } from "../../src/modules/v1/detection/findings/infrastructure/finding.repository";
import { ApiKeysService } from "../../src/modules/v1/identity/api-keys/application/api-keys.service";
import { ApiKeysRepository } from "../../src/modules/v1/identity/api-keys/infrastructure/api-keys.repository";
import { ProjectsRepository } from "../../src/modules/v1/identity/projects/infrastructure/projects.repository";

export const projectsRepository = new ProjectsRepository();
export const apiKeysRepository = new ApiKeysRepository();
export const apiKeysService = new ApiKeysService(apiKeysRepository);
export const findingsService = new FindingsService(new FindingRepository());

import { IncidentsRepository } from "../../src/modules/v1/detection/incidents/infrastructure/incidents.repository";
import { SyntheticProbesRepository } from "../../src/modules/v1/detection/synthetic-probes/infrastructure/synthetic-probes.repository";
import { ServicesRepository } from "../../src/modules/v1/delivery/services/infrastructure/services.repository";

export const incidentsRepository = new IncidentsRepository();
export const probesRepository = new SyntheticProbesRepository();
export const servicesRepository = new ServicesRepository();
import { ChatThreadsRepository } from "../../src/modules/v1/investigation/ai/investigation-chat/chat-threads.repository";
import { ServiceAccountsRepository } from "../../src/modules/v1/identity/service-accounts/infrastructure/service-accounts.repository";

export const chatThreadsRepository = new ChatThreadsRepository();
export const serviceAccountsRepository = new ServiceAccountsRepository();
