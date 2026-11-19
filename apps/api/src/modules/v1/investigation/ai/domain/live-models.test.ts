import { describe, expect, it, vi } from "vitest";
import { listLiveModels } from "./live-models";
import { LiveModelsError } from "./live-models.types";

const request = (fetchImpl: typeof fetch, apiKey = "k") => ({
  endpoint: "https://api.example.com/v1/",
  apiKey,
  timeoutMs: 1000,
  fetchImpl,
});

const json = (body: unknown, status = 200) => vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

describe("listLiveModels", () => {
  it("returns sorted, de-duplicated model ids and ignores malformed entries", async () => {
    const fetchImpl = json({ data: [{ id: "z" }, { id: "a" }, { id: "a" }, { id: "" }, {}, null, { id: 5 }] });

    await expect(listLiveModels(request(fetchImpl as never))).resolves.toEqual(["a", "z"]);
  });

  it("calls the models route once, without a doubled slash, with the key", async () => {
    const fetchImpl = json({ data: [] });

    await listLiveModels(request(fetchImpl as never, "secret"));

    expect(fetchImpl.mock.calls[0]?.[0]).toBe("https://api.example.com/v1/models");
    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ headers: { authorization: "Bearer secret" } });
  });

  it("sends no authorization header when there is no key", async () => {
    const fetchImpl = json({ data: [] });

    await listLiveModels(request(fetchImpl as never, ""));

    expect(fetchImpl.mock.calls[0]?.[1]).toMatchObject({ headers: {} });
  });

  it("reports a rejected key for 401 and 403", async () => {
    for (const status of [401, 403]) {
      await expect(listLiveModels(request(json({}, status) as never))).rejects.toMatchObject({ failure: "key_rejected", status });
    }
  });

  it("reports an unreachable endpoint when the request throws", async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error("boom"));

    await expect(listLiveModels(request(fetchImpl as never))).rejects.toMatchObject({ failure: "unreachable" });
  });

  it("reports a bad response for other statuses, non-JSON and the wrong shape", async () => {
    await expect(listLiveModels(request(json({}, 500) as never))).rejects.toMatchObject({ failure: "bad_response", status: 500 });
    await expect(listLiveModels(request(vi.fn().mockResolvedValue(new Response("<html>", { status: 200 })) as never))).rejects.toBeInstanceOf(LiveModelsError);
    await expect(listLiveModels(request(json({ models: ["a"] }) as never))).rejects.toMatchObject({ failure: "bad_response" });
  });
});
