import { describe, expect, it, vi } from "vitest";

const initNode = vi.hoisted(() => vi.fn(() => ({ captureException: () => {} })));
vi.mock("@soonwhy/node", () => ({ initNode }));

import { createSoonwhyInstrumentation } from "./instrumentation.js";

describe("createSoonwhyInstrumentation", () => {
  it("hands every option, including body capture and dependency reporting, to the node SDK", () => {
    const options = { apiKey: "k", serviceName: "s", captureBodies: true, reportDependencies: { apiEndpoint: "http://api/v1" } };
    createSoonwhyInstrumentation(options).register();
    expect(initNode).toHaveBeenCalledWith(options);
  });
});
