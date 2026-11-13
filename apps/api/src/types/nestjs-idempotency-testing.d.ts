// `@nestjs/idempotency` exposes ./testing through a package "exports" subpath.
// vite resolves it fine, but the backend's classic "moduleResolution" cannot,
// so point the type resolution at the explicit path inside the package.
declare module "@nestjs/idempotency/testing" {
  export * from "@nestjs/idempotency/dist/testing/index.js";
}
