/* eslint-disable */
// @ts-nocheck
import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as OrganizationSlugRouteImport } from './routes/$organizationSlug'
import { Route as LoginRouteImport } from './routes/login'
import { Route as OnboardingRouteImport } from './routes/onboarding'
import { Route as OrganizationsRouteImport } from './routes/organizations'
import { Route as RegisterRouteImport } from './routes/register'
import { Route as AuthCallbackRouteImport } from './routes/auth/callback'
import { Route as DashboardRouteImport } from './routes/$organizationSlug/dashboard'
import { Route as OrganizationIndexRouteImport } from './routes/$organizationSlug/index'
import { Route as DetectionsRouteImport } from './routes/$organizationSlug/detections'
import { Route as ErrorsRouteImport } from './routes/$organizationSlug/errors'
import { Route as InvestigationsRouteImport } from './routes/$organizationSlug/investigations'
import { Route as InvestigationDetailRouteImport } from './routes/$organizationSlug/investigations.$investigationId'
import { Route as LogsRouteImport } from './routes/$organizationSlug/logs'
import { Route as ServicesRouteImport } from './routes/$organizationSlug/services'
import { Route as ServiceDetailRouteImport } from './routes/$organizationSlug/service.$serviceId'
import { Route as SettingsRouteImport } from './routes/$organizationSlug/settings'
import { Route as AIRouteImport } from './routes/$organizationSlug/ai'
import { Route as TracesRouteImport } from './routes/$organizationSlug/traces'
import { Route as TraceDetailRouteImport } from './routes/$organizationSlug/trace.$traceId'

const IndexRoute = IndexRouteImport.update({ id: '/', path: '/', getParentRoute: () => rootRouteImport } as any)
const OrganizationSlugRoute = OrganizationSlugRouteImport.update({ id: '/$organizationSlug', path: '/$organizationSlug', getParentRoute: () => rootRouteImport } as any)
const LoginRoute = LoginRouteImport.update({ id: '/login', path: '/login', getParentRoute: () => rootRouteImport } as any)
const OnboardingRoute = OnboardingRouteImport.update({ id: '/onboarding', path: '/onboarding', getParentRoute: () => rootRouteImport } as any)
const OrganizationsRoute = OrganizationsRouteImport.update({ id: '/organizations', path: '/organizations', getParentRoute: () => rootRouteImport } as any)
const RegisterRoute = RegisterRouteImport.update({ id: '/register', path: '/register', getParentRoute: () => rootRouteImport } as any)
const AuthCallbackRoute = AuthCallbackRouteImport.update({ id: '/auth/callback', path: '/auth/callback', getParentRoute: () => rootRouteImport } as any)

const DashboardRoute = DashboardRouteImport.update({ id: '/$organizationSlug/dashboard', path: '/dashboard', getParentRoute: () => OrganizationSlugRoute } as any)
const OrganizationIndexRoute = OrganizationIndexRouteImport.update({ id: '/$organizationSlug/', path: '/', getParentRoute: () => OrganizationSlugRoute } as any)
const DetectionsRoute = DetectionsRouteImport.update({ id: '/$organizationSlug/detections', path: '/detections', getParentRoute: () => OrganizationSlugRoute } as any)
const ErrorsRoute = ErrorsRouteImport.update({ id: '/$organizationSlug/errors', path: '/errors', getParentRoute: () => OrganizationSlugRoute } as any)
const InvestigationsRoute = InvestigationsRouteImport.update({ id: '/$organizationSlug/investigations', path: '/investigations', getParentRoute: () => OrganizationSlugRoute } as any)
const InvestigationDetailRoute = InvestigationDetailRouteImport.update({ id: '/$organizationSlug/investigations/$investigationId', path: '/$investigationId', getParentRoute: () => InvestigationsRoute } as any)
const LogsRoute = LogsRouteImport.update({ id: '/$organizationSlug/logs', path: '/logs', getParentRoute: () => OrganizationSlugRoute } as any)
const ServicesRoute = ServicesRouteImport.update({ id: '/$organizationSlug/services', path: '/services', getParentRoute: () => OrganizationSlugRoute } as any)
const ServiceDetailRoute = ServiceDetailRouteImport.update({ id: '/$organizationSlug/service/$serviceId', path: '/service/$serviceId', getParentRoute: () => OrganizationSlugRoute } as any)
const SettingsRoute = SettingsRouteImport.update({ id: '/$organizationSlug/settings', path: '/settings', getParentRoute: () => OrganizationSlugRoute } as any)
const AIRoute = AIRouteImport.update({ id: '/$organizationSlug/ai', path: '/ai', getParentRoute: () => OrganizationSlugRoute } as any)
const TracesRoute = TracesRouteImport.update({ id: '/$organizationSlug/traces', path: '/traces', getParentRoute: () => OrganizationSlugRoute } as any)
const TraceDetailRoute = TraceDetailRouteImport.update({ id: '/$organizationSlug/trace/$traceId', path: '/trace/$traceId', getParentRoute: () => OrganizationSlugRoute } as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute; '/$organizationSlug': typeof OrganizationSlugRoute; '/$organizationSlug/': typeof OrganizationIndexRoute; '/login': typeof LoginRoute; '/onboarding': typeof OnboardingRoute; '/organizations': typeof OrganizationsRoute; '/register': typeof RegisterRoute; '/auth/callback': typeof AuthCallbackRoute;
  '/$organizationSlug/dashboard': typeof DashboardRoute; '/$organizationSlug/detections': typeof DetectionsRoute; '/$organizationSlug/errors': typeof ErrorsRoute; '/$organizationSlug/investigations': typeof InvestigationsRoute; '/$organizationSlug/investigations/$investigationId': typeof InvestigationDetailRoute; '/$organizationSlug/logs': typeof LogsRoute; '/$organizationSlug/services': typeof ServicesRoute; '/$organizationSlug/service/$serviceId': typeof ServiceDetailRoute; '/$organizationSlug/settings': typeof SettingsRoute; '/$organizationSlug/ai': typeof AIRoute; '/$organizationSlug/traces': typeof TracesRoute; '/$organizationSlug/trace/$traceId': typeof TraceDetailRoute;
}
export interface FileRoutesByTo extends FileRoutesByFullPath {}
export interface FileRoutesById extends FileRoutesByFullPath {}
export interface FileRouteTypes { fileRoutesByFullPath: FileRoutesByFullPath; fullPaths: keyof FileRoutesByFullPath; fileRoutesByTo: FileRoutesByTo; to: keyof FileRoutesByFullPath; id: keyof FileRoutesByFullPath; fileRoutesById: FileRoutesById; }

export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute; OrganizationSlugRoute: typeof OrganizationSlugRouteWithChildren; LoginRoute: typeof LoginRoute; OnboardingRoute: typeof OnboardingRoute; OrganizationsRoute: typeof OrganizationsRoute; RegisterRoute: typeof RegisterRoute; AuthCallbackRoute: typeof AuthCallbackRoute;
}
const InvestigationsRouteWithChildren = InvestigationsRoute._addFileChildren({ InvestigationDetailRoute });
const OrganizationSlugRouteChildren = { OrganizationIndexRoute, DashboardRoute, DetectionsRoute, ErrorsRoute, InvestigationsRoute: InvestigationsRouteWithChildren, LogsRoute, ServicesRoute, ServiceDetailRoute, SettingsRoute, AIRoute, TracesRoute, TraceDetailRoute };
const OrganizationSlugRouteWithChildren = OrganizationSlugRoute._addFileChildren(OrganizationSlugRouteChildren);
const rootRouteChildren: RootRouteChildren = { IndexRoute, OrganizationSlugRoute: OrganizationSlugRouteWithChildren, LoginRoute, OnboardingRoute, OrganizationsRoute, RegisterRoute, AuthCallbackRoute };
export const routeTree = rootRouteImport._addFileChildren(rootRouteChildren)._addFileTypes<FileRouteTypes>();

import type { getRouter } from './router.tsx'
import type { createStart } from '@tanstack/react-start'
declare module '@tanstack/react-start' { interface Register { ssr: true; router: Awaited<ReturnType<typeof getRouter>> } }
