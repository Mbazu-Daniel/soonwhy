import { BadRequestException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { assertSafeUserQuery, userQueryFailure } from "./user-query";

describe("assertSafeUserQuery", () => {
  it("accepts field filters, phrases, ranges and boolean operators", () => {
    const query = 'level:error AND (timeout OR "connection reset") AND attributes.http.status_code:>=500';
    expect(assertSafeUserQuery(`  ${query}  `)).toBe(query);
  });

  it("treats an empty query as no filter", () => {
    expect(assertSafeUserQuery("   ")).toBe("");
  });

  it("rejects a query that closes the tenant filter early", () => {
    expect(() => assertSafeUserQuery('*) OR (service:"api"')).toThrow(BadRequestException);
    expect(() => assertSafeUserQuery("a) OR (b")).toThrow(/unbalanced/);
  });

  it("rejects an unclosed quote and unbalanced parentheses", () => {
    expect(() => assertSafeUserQuery('message:"open')).toThrow(/unclosed quote/);
    expect(() => assertSafeUserQuery("(a AND b")).toThrow(/unbalanced/);
  });

  it("rejects any reference to the tenant fields", () => {
    expect(() => assertSafeUserQuery('org_id:"other"')).toThrow(/org_id or project_id/);
    expect(() => assertSafeUserQuery("x OR project_id:abc")).toThrow(/org_id or project_id/);
    expect(() => assertSafeUserQuery("NOT ORG_ID : x")).toThrow(/org_id or project_id/);
  });

  it("allows the words inside a quoted phrase and in other field names", () => {
    expect(assertSafeUserQuery('"missing org_id: header"')).toBe('"missing org_id: header"');
    expect(assertSafeUserQuery("attributes.my_org_id:5")).toBe("attributes.my_org_id:5");
  });

  it("is not fooled by an escaped quote", () => {
    expect(() => assertSafeUserQuery('message:"a \\" ) OR (org_id:x"')).not.toThrow();
    expect(() => assertSafeUserQuery('a \\" ) OR (org_id:x')).toThrow();
  });

  it("rejects a query that is too long", () => {
    expect(() => assertSafeUserQuery("a".repeat(2001))).toThrow(/longer than/);
  });
});

describe("userQueryFailure", () => {
  it("turns a Quickwit 400 into a readable bad request", () => {
    const error = new Error('Quickwit request failed (400): {"message":"Query is invalid: unexpected token"}');
    expect(userQueryFailure(error)?.message).toBe("Invalid search query: Query is invalid: unexpected token");
  });

  it("leaves other failures alone", () => {
    expect(userQueryFailure(new Error("Quickwit request failed (500): boom"))).toBeUndefined();
    expect(userQueryFailure("nope")).toBeUndefined();
  });
});
