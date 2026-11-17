export type WriteMethod = "POST" | "PUT" | "PATCH" | "DELETE";

export type WriteRoute = {
  key: string;
  controller: Function;
  controllerName: string;
  handlerName: string;
  method: WriteMethod;
  path: string;
};

export type RoutePolicy = "admin" | "member" | "platform" | "public" | "unguarded";

export type RouteOutcome = "rejected" | "allowed";

export type RouteCaller = {
  role: string | undefined;
  signedIn: boolean;
  inOrganization: boolean;
};
