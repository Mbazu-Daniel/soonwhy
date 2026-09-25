/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

import { Route as rootRouteImport } from './routes/__root'
import { Route as IndexRouteImport } from './routes/index'
import { Route as OrganizationsRouteImport } from './routes/organizations'
import { Route as OnboardingRouteImport } from './routes/onboarding'
import { Route as AuthSignInRouteImport } from './routes/auth/sign-in'
import { Route as AuthSignUpRouteImport } from './routes/auth/sign-up'
import { Route as DashboardIndexRouteImport } from './routes/dashboard/index'
import { Route as DashboardErrorsRouteImport } from './routes/dashboard/errors'
import { Route as DashboardDetectionsRouteImport } from './routes/dashboard/detections'
import { Route as DashboardLayoutRouteImport } from './routes/dashboard/layout'
import { Route as DashboardLogsRouteImport } from './routes/dashboard/logs'
import { Route as DashboardServicesRouteImport } from './routes/dashboard/services'
import { Route as DashboardSettingsRouteImport } from './routes/dashboard/settings'
import { Route as DashboardServiceServiceIdRouteImport } from './routes/dashboard/service.$serviceId'
import { Route as DashboardTracesRouteImport } from './routes/dashboard/traces'
import { Route as DashboardTraceTraceIdRouteImport } from './routes/dashboard/trace.$traceId'
import { Route as DashboardInvestigationsRouteImport } from './routes/dashboard/investigations'
import { Route as DashboardInvestigationsInvestigationIdRouteImport } from './routes/dashboard/investigations.$investigationId'

const IndexRoute = IndexRouteImport.update({
  id: '/',
  path: '/',
  getParentRoute: () => rootRouteImport,
} as any)
const OnboardingRoute = OnboardingRouteImport.update({
  id: '/onboarding',
  path: '/onboarding',
  getParentRoute: () => rootRouteImport,
} as any)
const OrganizationsRoute = OrganizationsRouteImport.update({
  id: '/organizations',
  path: '/organizations',
  getParentRoute: () => rootRouteImport,
} as any)
const AuthSignInRoute = AuthSignInRouteImport.update({
  id: '/auth/sign-in',
  path: '/auth/sign-in',
  getParentRoute: () => rootRouteImport,
} as any)
const AuthSignUpRoute = AuthSignUpRouteImport.update({
  id: '/auth/sign-up',
  path: '/auth/sign-up',
  getParentRoute: () => rootRouteImport,
} as any)
const DashboardIndexRoute = DashboardIndexRouteImport.update({
  id: '/dashboard/',
  path: '/dashboard/',
  getParentRoute: () => rootRouteImport,
} as any)
const DashboardDetectionsRoute = DashboardDetectionsRouteImport.update({
  id: '/dashboard/detections',
  path: '/dashboard/detections',
  getParentRoute: () => rootRouteImport,
} as any)
const DashboardErrorsRoute = DashboardErrorsRouteImport.update({
  id: '/dashboard/errors',
  path: '/dashboard/errors',
  getParentRoute: () => rootRouteImport,
} as any)
const DashboardLayoutRoute = DashboardLayoutRouteImport.update({
  id: '/dashboard/layout',
  path: '/dashboard/layout',
  getParentRoute: () => rootRouteImport,
} as any)
const DashboardLogsRoute = DashboardLogsRouteImport.update({
  id: '/dashboard/logs',
  path: '/dashboard/logs',
  getParentRoute: () => rootRouteImport,
} as any)
const DashboardServicesRoute = DashboardServicesRouteImport.update({
  id: '/dashboard/services',
  path: '/dashboard/services',
  getParentRoute: () => rootRouteImport,
} as any)
const DashboardSettingsRoute = DashboardSettingsRouteImport.update({
  id: '/dashboard/settings',
  path: '/dashboard/settings',
  getParentRoute: () => rootRouteImport,
} as any)
const DashboardServiceServiceIdRoute = DashboardServiceServiceIdRouteImport.update({
  id: '/dashboard/service/$serviceId',
  path: '/dashboard/service/$serviceId',
  getParentRoute: () => rootRouteImport,
} as any)
const DashboardTracesRoute = DashboardTracesRouteImport.update({
  id: '/dashboard/traces',
  path: '/dashboard/traces',
  getParentRoute: () => rootRouteImport,
} as any)
const DashboardTraceTraceIdRoute = DashboardTraceTraceIdRouteImport.update({
  id: '/dashboard/trace/$traceId',
  path: '/dashboard/trace/$traceId',
  getParentRoute: () => rootRouteImport,
} as any)
const DashboardInvestigationsRoute = DashboardInvestigationsRouteImport.update({
  id: '/dashboard/investigations',
  path: '/dashboard/investigations',
  getParentRoute: () => rootRouteImport,
} as any)
const DashboardInvestigationsInvestigationIdRoute = DashboardInvestigationsInvestigationIdRouteImport.update({
  id: '/dashboard/investigations/$investigationId',
  path: '/dashboard/investigations/$investigationId',
  getParentRoute: () => rootRouteImport,
} as any)

export interface FileRoutesByFullPath {
  '/': typeof IndexRoute
  '/organizations': typeof OrganizationsRoute
  '/onboarding': typeof OnboardingRoute
  '/auth/sign-in': typeof AuthSignInRoute
  '/auth/sign-up': typeof AuthSignUpRoute
  '/dashboard/errors': typeof DashboardErrorsRoute
  '/dashboard/detections': typeof DashboardDetectionsRoute
  '/dashboard/layout': typeof DashboardLayoutRoute
  '/dashboard/logs': typeof DashboardLogsRoute
  '/dashboard/services': typeof DashboardServicesRoute
  '/dashboard/settings': typeof DashboardSettingsRoute
  '/dashboard/service/$serviceId': typeof DashboardServiceServiceIdRoute
  '/dashboard/traces': typeof DashboardTracesRoute
  '/dashboard/trace/$traceId': typeof DashboardTraceTraceIdRoute
  '/dashboard/investigations': typeof DashboardInvestigationsRoute
  '/dashboard/investigations/$investigationId': typeof DashboardInvestigationsInvestigationIdRoute
  '/dashboard/': typeof DashboardIndexRoute
}
export interface FileRoutesByTo {
  '/': typeof IndexRoute
  '/organizations': typeof OrganizationsRoute
  '/onboarding': typeof OnboardingRoute
  '/auth/sign-in': typeof AuthSignInRoute
  '/auth/sign-up': typeof AuthSignUpRoute
  '/dashboard/errors': typeof DashboardErrorsRoute
  '/dashboard/detections': typeof DashboardDetectionsRoute
  '/dashboard/layout': typeof DashboardLayoutRoute
  '/dashboard/logs': typeof DashboardLogsRoute
  '/dashboard/services': typeof DashboardServicesRoute
  '/dashboard/settings': typeof DashboardSettingsRoute
  '/dashboard/service/$serviceId': typeof DashboardServiceServiceIdRoute
  '/dashboard/traces': typeof DashboardTracesRoute
  '/dashboard/trace/$traceId': typeof DashboardTraceTraceIdRoute
  '/dashboard/investigations': typeof DashboardInvestigationsRoute
  '/dashboard/investigations/$investigationId': typeof DashboardInvestigationsInvestigationIdRoute
  '/dashboard': typeof DashboardIndexRoute
}
export interface FileRoutesById {
  __root__: typeof rootRouteImport
  '/': typeof IndexRoute
  '/onboarding': typeof OnboardingRoute
  '/organizations': typeof OrganizationsRoute
  '/auth/sign-in': typeof AuthSignInRoute
  '/auth/sign-up': typeof AuthSignUpRoute
  '/dashboard/errors': typeof DashboardErrorsRoute
  '/dashboard/detections': typeof DashboardDetectionsRoute
  '/dashboard/layout': typeof DashboardLayoutRoute
  '/dashboard/logs': typeof DashboardLogsRoute
  '/dashboard/services': typeof DashboardServicesRoute
  '/dashboard/settings': typeof DashboardSettingsRoute
  '/dashboard/service/$serviceId': typeof DashboardServiceServiceIdRoute
  '/dashboard/traces': typeof DashboardTracesRoute
  '/dashboard/trace/$traceId': typeof DashboardTraceTraceIdRoute
  '/dashboard/investigations': typeof DashboardInvestigationsRoute
  '/dashboard/investigations/$investigationId': typeof DashboardInvestigationsInvestigationIdRoute
  '/dashboard/': typeof DashboardIndexRoute
}
export interface FileRouteTypes {
  fileRoutesByFullPath: FileRoutesByFullPath
  fullPaths:
    | '/'
    | '/organizations'
    | '/onboarding'
    | '/auth/sign-in'
    | '/auth/sign-up'
    | '/dashboard/errors'
    | '/dashboard/detections'
    | '/dashboard/layout'
    | '/dashboard/logs'
    | '/dashboard/services'
    | '/dashboard/settings'
    | '/dashboard/service/$serviceId'
    | '/dashboard/traces'
    | '/dashboard/trace/$traceId'
    | '/dashboard/investigations'
    | '/dashboard/investigations/$investigationId'
    | '/dashboard/'
  fileRoutesByTo: FileRoutesByTo
  to:
    | '/'
    | '/organizations'
    | '/onboarding'
    | '/auth/sign-in'
    | '/auth/sign-up'
    | '/dashboard/errors'
    | '/dashboard/detections'
    | '/dashboard/layout'
    | '/dashboard/logs'
    | '/dashboard/services'
    | '/dashboard/settings'
    | '/dashboard/service/$serviceId'
    | '/dashboard/traces'
    | '/dashboard/trace/$traceId'
    | '/dashboard/investigations'
    | '/dashboard/investigations/$investigationId'
    | '/dashboard'
  id:
    | '__root__'
    | '/'
    | '/onboarding'
    | '/organizations'
    | '/auth/sign-in'
    | '/auth/sign-up'
    | '/dashboard/errors'
    | '/dashboard/detections'
    | '/dashboard/layout'
    | '/dashboard/logs'
    | '/dashboard/services'
    | '/dashboard/settings'
    | '/dashboard/service/$serviceId'
    | '/dashboard/traces'
    | '/dashboard/trace/$traceId'
    | '/dashboard/investigations'
    | '/dashboard/investigations/$investigationId'
    | '/dashboard/'
  fileRoutesById: FileRoutesById
}
export interface RootRouteChildren {
  IndexRoute: typeof IndexRoute
  OrganizationsRoute: typeof OrganizationsRoute
  OnboardingRoute: typeof OnboardingRoute
  AuthSignInRoute: typeof AuthSignInRoute
  AuthSignUpRoute: typeof AuthSignUpRoute
  DashboardErrorsRoute: typeof DashboardErrorsRoute
  DashboardDetectionsRoute: typeof DashboardDetectionsRoute
  DashboardLayoutRoute: typeof DashboardLayoutRoute
  DashboardLogsRoute: typeof DashboardLogsRoute
  DashboardServicesRoute: typeof DashboardServicesRoute
  DashboardSettingsRoute: typeof DashboardSettingsRoute
  DashboardServiceServiceIdRoute: typeof DashboardServiceServiceIdRoute
  DashboardTracesRoute: typeof DashboardTracesRoute
  DashboardTraceTraceIdRoute: typeof DashboardTraceTraceIdRoute
  DashboardInvestigationsRoute: typeof DashboardInvestigationsRoute
  DashboardInvestigationsInvestigationIdRoute: typeof DashboardInvestigationsInvestigationIdRoute
  DashboardIndexRoute: typeof DashboardIndexRoute
}

declare module '@tanstack/react-router' {
  interface FileRoutesByPath {
    '/': {
      id: '/'
      path: '/'
      fullPath: '/'
      preLoaderRoute: typeof IndexRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/onboarding': {
      id: '/onboarding'
      path: '/onboarding'
      fullPath: '/onboarding'
      preLoaderRoute: typeof OnboardingRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/organizations': {
      id: '/organizations'
      path: '/organizations'
      fullPath: '/organizations'
      preLoaderRoute: typeof OrganizationsRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/auth/sign-in': {
      id: '/auth/sign-in'
      path: '/auth/sign-in'
      fullPath: '/auth/sign-in'
      preLoaderRoute: typeof AuthSignInRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/auth/sign-up': {
      id: '/auth/sign-up'
      path: '/auth/sign-up'
      fullPath: '/auth/sign-up'
      preLoaderRoute: typeof AuthSignUpRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/dashboard/': {
      id: '/dashboard/'
      path: '/dashboard'
      fullPath: '/dashboard/'
      preLoaderRoute: typeof DashboardIndexRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/dashboard/detections': {
      id: '/dashboard/detections'
      path: '/dashboard/detections'
      fullPath: '/dashboard/detections'
      preLoaderRoute: typeof DashboardDetectionsRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/dashboard/errors': {
      id: '/dashboard/errors'
      path: '/dashboard/errors'
      fullPath: '/dashboard/errors'
      preLoaderRoute: typeof DashboardErrorsRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/dashboard/layout': {
      id: '/dashboard/layout'
      path: '/dashboard/layout'
      fullPath: '/dashboard/layout'
      preLoaderRoute: typeof DashboardLayoutRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/dashboard/logs': {
      id: '/dashboard/logs'
      path: '/dashboard/logs'
      fullPath: '/dashboard/logs'
      preLoaderRoute: typeof DashboardLogsRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/dashboard/services': {
      id: '/dashboard/services'
      path: '/dashboard/services'
      fullPath: '/dashboard/services'
      preLoaderRoute: typeof DashboardServicesRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/dashboard/settings': {
      id: '/dashboard/settings'
      path: '/dashboard/settings'
      fullPath: '/dashboard/settings'
      preLoaderRoute: typeof DashboardSettingsRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/dashboard/service/$serviceId': {
      id: '/dashboard/service/$serviceId'
      path: '/dashboard/service/$serviceId'
      fullPath: '/dashboard/service/$serviceId'
      preLoaderRoute: typeof DashboardServiceServiceIdRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/dashboard/traces': {
      id: '/dashboard/traces'
      path: '/dashboard/traces'
      fullPath: '/dashboard/traces'
      preLoaderRoute: typeof DashboardTracesRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/dashboard/trace/$traceId': {
      id: '/dashboard/trace/$traceId'
      path: '/dashboard/trace/$traceId'
      fullPath: '/dashboard/trace/$traceId'
      preLoaderRoute: typeof DashboardTraceTraceIdRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/dashboard/investigations': {
      id: '/dashboard/investigations'
      path: '/dashboard/investigations'
      fullPath: '/dashboard/investigations'
      preLoaderRoute: typeof DashboardInvestigationsRouteImport
      parentRoute: typeof rootRouteImport
    }
    '/dashboard/investigations/$investigationId': {
      id: '/dashboard/investigations/$investigationId'
      path: '/dashboard/investigations/$investigationId'
      fullPath: '/dashboard/investigations/$investigationId'
      preLoaderRoute: typeof DashboardInvestigationsInvestigationIdRouteImport
      parentRoute: typeof rootRouteImport
    }
  }
}

const rootRouteChildren: RootRouteChildren = {
  IndexRoute: IndexRoute,
  OrganizationsRoute: OrganizationsRoute,
  OnboardingRoute: OnboardingRoute,
  AuthSignInRoute: AuthSignInRoute,
  AuthSignUpRoute: AuthSignUpRoute,
  DashboardErrorsRoute: DashboardErrorsRoute,
  DashboardDetectionsRoute: DashboardDetectionsRoute,
  DashboardLayoutRoute: DashboardLayoutRoute,
  DashboardLogsRoute: DashboardLogsRoute,
  DashboardServicesRoute: DashboardServicesRoute,
  DashboardSettingsRoute: DashboardSettingsRoute,
  DashboardServiceServiceIdRoute: DashboardServiceServiceIdRoute,
  DashboardTracesRoute: DashboardTracesRoute,
  DashboardTraceTraceIdRoute: DashboardTraceTraceIdRoute,
  DashboardInvestigationsRoute: DashboardInvestigationsRoute,
  DashboardInvestigationsInvestigationIdRoute: DashboardInvestigationsInvestigationIdRoute,
  DashboardIndexRoute: DashboardIndexRoute,
}
export const routeTree = rootRouteImport
  ._addFileChildren(rootRouteChildren)
  ._addFileTypes<FileRouteTypes>()

import type { getRouter } from './router.tsx'
import type { createStart } from '@tanstack/react-start'
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
  }
}
