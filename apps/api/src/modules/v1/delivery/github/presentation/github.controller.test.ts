import "reflect-metadata";
import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GithubController } from "./github.controller";
import { GithubSetupController } from "./github-setup.controller";
import { GithubService } from "../application/github.service";

vi.mock("../../../../../common/db", () => ({ db: {} }));

const body = Buffer.from(JSON.stringify({ repository: { html_url: "https://github.com/acme/app" }, after: "abc1234567" }));
const sign = (secret: string) => `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
const request = { rawBody: body } as never;

describe("github webhook tenant binding", () => {
  let service: GithubService;
  let controller: GithubController;

  beforeEach(() => {
    process.env.GITHUB_WEBHOOK_SECRET = "master-secret";
    service = new GithubService();
    controller = new GithubController(service);
  });

  it("derives a different secret for every project", () => {
    expect(service.secretForProject("proj_a")).not.toBe(service.secretForProject("proj_b"));
    expect(service.secretForProject("proj_a")).toBe(service.secretForProject("proj_a"));
  });

  it("rejects a payload signed with another project's secret", async () => {
    const foreign = sign(service.secretForProject("proj_b"));
    await expect(controller.webhook(request, "proj_a", "push", foreign, "d1")).rejects.toThrow("Invalid GitHub webhook signature");
  });

  it("rejects a payload signed with the master secret", async () => {
    await expect(controller.webhook(request, "proj_a", "push", sign("master-secret"), "d1")).rejects.toThrow("Invalid GitHub webhook signature");
  });

  it("only looks at the project in the url once the signature matches", async () => {
    const handle = vi.spyOn(service, "handlePushEvent").mockResolvedValue({ handled: false, reason: "no matching service" });
    await controller.webhook(request, "proj_a", "push", sign(service.secretForProject("proj_a")), "d1");
    expect(handle).toHaveBeenCalledWith("proj_a", body, "push", "d1");
  });

  it("hands members the url path and secret for their own project", () => {
    const setup = new GithubSetupController(service);
    expect(setup.webhook("proj_a")).toMatchObject({
      path: "github/webhook/proj_a",
      secret: service.secretForProject("proj_a"),
    });
  });
});
