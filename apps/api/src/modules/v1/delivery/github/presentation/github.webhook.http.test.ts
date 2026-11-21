import "reflect-metadata";
import { createHmac } from "node:crypto";
import { Module, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NodeAdapter, type NestNodeApplication } from "@nestjs/platform-node";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { APP_CREATE_OPTIONS } from "../../../../../common/app-options";
import { GithubController } from "./github.controller";
import { GithubService } from "../application/github.service";

vi.mock("../../../../../common/db", () => ({ db: {} }));

Reflect.defineMetadata("design:paramtypes", [GithubService], GithubController);

@Module({ controllers: [GithubController], providers: [GithubService] })
class WebhookModule {}

const payload = JSON.stringify({ repository: { html_url: "https://github.com/acme/app" }, after: "abc1234567" });

describe("github webhook over HTTP", () => {
  let app: INestApplication;
  let url: string;
  const service = new GithubService();
  const handle = vi.spyOn(GithubService.prototype, "handlePushEvent").mockResolvedValue({ handled: true } as never);

  beforeAll(async () => {
    process.env.GITHUB_WEBHOOK_SECRET = "master-secret";
    app = await NestFactory.create<NestNodeApplication>(WebhookModule, new NodeAdapter(), { ...APP_CREATE_OPTIONS, logger: ["error"] });
    await app.listen(0);
    url = await app.getUrl();
  }, 60_000);

  afterAll(async () => {
    await app.close();
  });

  const post = (projectId: string, signature: string) =>
    fetch(`${url}/github/webhook/${projectId}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-github-event": "push", "x-hub-signature-256": signature },
      body: payload,
    });
  const sign = (secret: string) => `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;

  it("accepts a delivery signed with the project's secret", async () => {
    const response = await post("proj_a", sign(service.secretForProject("proj_a")));
    expect(response.status).toBe(200);
    expect(handle).toHaveBeenCalledWith("proj_a", expect.any(Buffer), "push", undefined);
  });

  it("rejects a delivery signed with another project's secret", async () => {
    expect((await post("proj_a", sign(service.secretForProject("proj_b")))).status).toBe(401);
  });
});
