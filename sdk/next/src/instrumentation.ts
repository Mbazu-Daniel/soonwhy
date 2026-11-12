import { initNode, type NodeSdk, type NodeSdkOptions } from "@soonwhy/node";
import type {
  SoonwhyInstrumentation,
  SoonwhyRequestErrorContext,
  SoonwhyRequestErrorRequest,
} from "./types.js";

export function createSoonwhyInstrumentation(
  options: NodeSdkOptions,
): SoonwhyInstrumentation {
  let client: NodeSdk | undefined;

  const ensureClient = (): NodeSdk => {
    client ??= initNode(options);
    return client;
  };

  return {
    register: () => {
      ensureClient();
    },
    onRequestError: (
      error: unknown,
      request: SoonwhyRequestErrorRequest,
      context?: SoonwhyRequestErrorContext,
    ) => {
      try {
        const active = ensureClient();
        const attributes: Record<string, string> = {};
        if (request.path) attributes["next.path"] = request.path;
        if (request.method) attributes["next.method"] = request.method;
        if (context?.routePath) attributes["next.route_path"] = context.routePath;
        if (context?.routeType) attributes["next.route_type"] = context.routeType;
        if (context?.routerKind) attributes["next.router_kind"] = context.routerKind;
        active.captureError({ error, attributes });
      } catch (failure) {
        console.warn(
          `[Soonwhy] onRequestError failed: ${failure instanceof Error ? failure.message : "unknown error"}`,
        );
      }
    },
  };
}
