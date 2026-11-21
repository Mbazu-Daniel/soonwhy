import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";

const initNode = vi.hoisted(() => vi.fn(() => ({ shutdown: async () => {} })));
vi.mock("@soonwhy/node", () => ({ initNode }));

import { SoonwhyModule } from "./soonwhy.module.js";
import { SOONWHY_SDK } from "./constants.js";

describe("SoonwhyModule.forRoot", () => {
  it("hands every option, including body capture and dependency reporting, to the node SDK", () => {
    const options = { apiKey: "k", serviceName: "s", captureBodies: true, reportDependencies: { apiEndpoint: "http://api/v1" } };
    const provider = SoonwhyModule.forRoot(options).providers!.find((entry) => (entry as { provide?: unknown }).provide === SOONWHY_SDK) as { useFactory: () => unknown };
    provider.useFactory();
    expect(initNode).toHaveBeenCalledWith(options);
  });
});
