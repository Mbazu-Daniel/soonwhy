import type { Plugin, ViteDevServer } from "vite";
import { initNode, shutdown, type NodeSdkOptions } from "@soonwhy/node";
import { PLUGIN_NAME } from "./constants.js";

export default function soonwhyVite(options: NodeSdkOptions): Plugin {
  return {
    name: PLUGIN_NAME,
    apply: "serve",
    configureServer(server: ViteDevServer) {
      if (!server.httpServer) {
        server.config.logger?.warn(
          "[Soonwhy] httpServer is not available; telemetry will not be started.",
        );
        return;
      }
      try {
        initNode(options);
      } catch (error) {
        server.config.logger?.warn(
          `[Soonwhy] Telemetry failed to start: ${error instanceof Error ? error.message : "unknown error"}`,
        );
        return;
      }
      server.httpServer.once("close", () => {
        void shutdown();
      });
    },
  };
}

export { soonwhyVite as soonwhy };
export type { NodeSdkOptions };
