import { NotFoundException } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HostsService } from "./hosts.service";

const { selects, updated } = vi.hoisted(() => ({ selects: [] as unknown[][], updated: vi.fn() }));

vi.mock("../../../common/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => {
          const rows = selects.shift() ?? [];
          return Object.assign(Promise.resolve(rows), { orderBy: () => Promise.resolve(rows) });
        },
      }),
    }),
    update: () => ({
      set: (value: unknown) => {
        updated(value);
        return { where: () => ({ returning: () => Promise.resolve([{ id: "h1", projectId: "p2" }]) }) };
      },
    }),
  },
}));


describe("HostsService", () => {
  beforeEach(() => {
    selects.length = 0;
    updated.mockReset();
  });

  it("lists the hosts linked to a project", async () => {
    selects.push([{ id: "h1", hostName: "web-1" }]);
    await expect(new HostsService().listForProject("o1", "p1")).resolves.toEqual([{ id: "h1", hostName: "web-1" }]);
  });

  it("moves a host to another project in the same organization", async () => {
    selects.push([{ id: "h1" }], [{ id: "p2" }]);
    await expect(new HostsService().moveHost("o1", "p1", "h1", "p2")).resolves.toMatchObject({ projectId: "p2" });
    expect(updated).toHaveBeenCalledWith({ projectId: "p2" });
  });

  it("does not move a host that is not in this project", async () => {
    selects.push([]);
    await expect(new HostsService().moveHost("o1", "p1", "h9", "p2")).rejects.toBeInstanceOf(NotFoundException);
    expect(updated).not.toHaveBeenCalled();
  });

  it("does not move a host into a project outside the organization", async () => {
    selects.push([{ id: "h1" }], []);
    await expect(new HostsService().moveHost("o1", "p1", "h1", "other-org-project")).rejects.toBeInstanceOf(NotFoundException);
    expect(updated).not.toHaveBeenCalled();
  });
});
