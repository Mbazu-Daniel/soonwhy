import type { RoutePolicy } from "./types";

export const ORGANIZATION_ID = "org_1";
export const PARAM_ROUTE_ARGUMENT = 5;

export const CONTROLLER_POLICY: Record<string, RoutePolicy> = {
  AiController: "admin",
  AuthController: "public",
  AutoAnalysisController: "admin",
  ClientEventsController: "public",
  DetectorConfigController: "admin",
  DetectorSettingsController: "admin",
  DlqController: "platform",
  GithubController: "public",
  HostsController: "admin",
  OrganizationController: "admin",
  OrganizationsController: "public",
  ProjectsController: "admin",
  ServiceAccountsController: "admin",
  StatusPageSubscriptionsController: "public",

  AIInvestigationController: "member",
  ApiKeysController: "member",
  BusinessOperationsController: "member",
  CanaryController: "member",
  CapacityMonitoringController: "member",
  DashboardController: "member",
  DeploymentsController: "member",
  DetectionController: "member",
  EnvironmentsController: "member",
  ErrorIgnoreRulesController: "admin",
  ErrorRegressionsController: "member",
  DependenciesController: "member",
  FindingsController: "member",
  IncidentsController: "member",
  IngestLimitsController: "member",
  InvestigationChatController: "member",
  InvestigationController: "member",
  MaintenanceWindowsController: "member",
  NotificationsController: "member",
  OrgNotificationsController: "member",
  QueryCatalogController: "member",
  RcaController: "member",
  RetentionPoliciesController: "admin",
  ServicesController: "member",
  SlosController: "member",
  SuppressionRulesController: "member",
  SyntheticProbesController: "member",
  TeamsController: "member",
  UploadsController: "member",

  EvidenceGraphController: "member",
};

export const ROUTE_POLICY_OVERRIDES: Record<string, RoutePolicy> = {
  "AiController.chat": "member",
  "OrganizationController.updateMemberProfile": "member",
  "ProjectsController.updateProjectSettings": "member",
};
