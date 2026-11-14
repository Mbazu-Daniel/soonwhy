import { BadRequestException, HttpException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { GlobalExceptionFilter } from "./http-exception.filter";

function run(exception: unknown) {
  const json = vi.fn((_body: Record<string, any>) => undefined);
  const status = vi.fn((_code: number) => ({ json }));
  const host = { switchToHttp: () => ({ getResponse: () => ({ status }) }) };
  new GlobalExceptionFilter().catch(exception, host as never);
  return { status: status.mock.calls[0]![0], body: json.mock.calls[0]![0] };
}

describe("GlobalExceptionFilter", () => {
  it("titles a field validation failure by its real status", () => {
    const { status, body } = run(
      new HttpException({ formErrors: [], fieldErrors: { limit: ["too big"] } }, 400),
    );
    expect(status).toBe(400);
    expect(body.title).toBe("Bad Request");
    expect(body.detail).toBe("Request validation failed");
    expect(body.status).toBe(400);
  });

  it("keeps the framework error name when one is provided", () => {
    expect(run(new NotFoundException("nope")).body.title).toBe("Not Found");
    expect(run(new BadRequestException("bad")).body.detail).toBe("bad");
  });

  it("still reports unknown errors as 500", () => {
    const { status, body } = run(new Error("boom"));
    expect(status).toBe(500);
    expect(body.title).toBe("Internal Server Error");
  });
});
