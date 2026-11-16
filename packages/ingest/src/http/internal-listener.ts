import { createServer, type Server } from "node:http";
import type { INestApplication } from "@nestjs/common";
import type { Request } from "express";

export function internalPortFrom(
  value: string | undefined,
  publicPort: number,
): number | undefined {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return undefined;
  return port === publicPort ? undefined : port;
}

export function isInternalRequest(
  req: Pick<Request, "socket">,
  internalPort: number | undefined,
): boolean {
  return internalPort !== undefined && req.socket.localPort === internalPort;
}

export function startInternalListener(app: INestApplication, port: number): Server {
  const server = createServer(app.getHttpAdapter().getInstance());
  server.listen(port, "0.0.0.0");
  server.unref();
  return server;
}
