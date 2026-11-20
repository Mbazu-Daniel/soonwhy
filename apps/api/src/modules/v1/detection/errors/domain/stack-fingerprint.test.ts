import { describe, expect, it } from "vitest";
import { errorFingerprint } from "./error-fingerprint";

const stack = (line: number, dir = "/srv/app/dist", top = "OrdersService.create") =>
  `TypeError: x\n    at ${top} (${dir}/orders.service.js:${line}:13)\n    at OrdersController.order (${dir}/orders.controller.js:${line + 9}:24)\n    at Layer.handle (/srv/app/node_modules/express/lib/router/layer.js:95:5)`;

const source = (message: string, stackTrace: string | undefined, service = "api") => ({
  service,
  message,
  stackTrace,
  attributes: { "exception.type": "TypeError" },
});

describe("stack-based fingerprint", () => {
  it("groups the same stack together when only the message differs", () => {
    expect(errorFingerprint(source("Order alice failed", stack(23)))).toBe(
      errorFingerprint(source("Order bob failed", stack(23))),
    );
  });

  it("ignores line numbers and install directories", () => {
    expect(errorFingerprint(source("a", stack(23)))).toBe(
      errorFingerprint(source("a", stack(41, "/app/build"))),
    );
  });

  it("separates errors thrown from different code", () => {
    expect(errorFingerprint(source("a", stack(23)))).not.toBe(
      errorFingerprint(source("a", stack(23, "/srv/app/dist", "BillingService.charge"))),
    );
  });

  it("separates services", () => {
    expect(errorFingerprint(source("a", stack(23)))).not.toBe(
      errorFingerprint(source("a", stack(23), "worker")),
    );
  });

  it("falls back to the message when there is no application frame", () => {
    const libraryOnly = "Error: x\n    at Layer.handle (/srv/app/node_modules/express/lib/router/layer.js:95:5)";
    expect(errorFingerprint(source("alpha", undefined))).not.toBe(errorFingerprint(source("beta", undefined)));
    expect(errorFingerprint(source("alpha", libraryOnly))).not.toBe(errorFingerprint(source("beta", libraryOnly)));
  });
});
