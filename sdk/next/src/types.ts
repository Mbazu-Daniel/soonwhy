export interface SoonwhyRouteContext {
  request: Request;
  pathname: string;
  method: string;
}

export interface SoonwhyRouteOptions {
  routeResolver?: (context: SoonwhyRouteContext) => string | null | undefined;
  ignore?: (context: SoonwhyRouteContext) => boolean;
  ignoreDefaultPaths?: boolean;
  recordExceptions?: boolean;
}

export interface SoonwhyRequestErrorRequest {
  path?: string;
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
}

export interface SoonwhyRequestErrorContext {
  routerKind?: string;
  routePath?: string;
  routeType?: string;
}

export interface SoonwhyInstrumentation {
  register: () => void;
  onRequestError: (
    error: unknown,
    request: SoonwhyRequestErrorRequest,
    context?: SoonwhyRequestErrorContext,
  ) => void;
}
