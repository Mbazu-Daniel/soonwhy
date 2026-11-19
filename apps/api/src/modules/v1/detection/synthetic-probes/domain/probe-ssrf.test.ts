import { describe, expect, it } from "vitest";
import { isPublicIpAddress } from "./probe-ssrf";

describe("isPublicIpAddress", () => {
  it("accepts globally routable IPv4 addresses", () => {
    expect(isPublicIpAddress("8.8.8.8")).toBe(true);
    expect(isPublicIpAddress("1.1.1.1")).toBe(true);
    expect(isPublicIpAddress("172.32.0.1")).toBe(true);
    expect(isPublicIpAddress("151.101.1.69")).toBe(true);
  });

  it("rejects private and reserved IPv4 ranges", () => {
    expect(isPublicIpAddress("10.0.0.5")).toBe(false);
    expect(isPublicIpAddress("172.16.23.4")).toBe(false);
    expect(isPublicIpAddress("192.168.1.1")).toBe(false);
    expect(isPublicIpAddress("127.0.0.1")).toBe(false);
    expect(isPublicIpAddress("0.1.2.3")).toBe(false);
    expect(isPublicIpAddress("169.254.1.1")).toBe(false);
    expect(isPublicIpAddress("100.64.0.1")).toBe(false);
    expect(isPublicIpAddress("192.0.2.10")).toBe(false);
    expect(isPublicIpAddress("198.51.100.1")).toBe(false);
    expect(isPublicIpAddress("203.0.113.9")).toBe(false);
    expect(isPublicIpAddress("224.0.0.1")).toBe(false);
    expect(isPublicIpAddress("255.255.255.255")).toBe(false);
    expect(isPublicIpAddress("198.18.0.23")).toBe(false);
  });

  it("accepts globally routable IPv6 addresses", () => {
    expect(isPublicIpAddress("2001:4860:4860::8888")).toBe(true);
    expect(isPublicIpAddress("2606:4700:4700::1111")).toBe(true);
  });

  it("rejects non-global IPv6 addresses", () => {
    expect(isPublicIpAddress("::1")).toBe(false);
    expect(isPublicIpAddress("fc00::1")).toBe(false);
    expect(isPublicIpAddress("fe80::1")).toBe(false);
    expect(isPublicIpAddress("ff02::1")).toBe(false);
    expect(isPublicIpAddress("2001:db8::1")).toBe(false);
    expect(isPublicIpAddress("::ffff:10.0.0.5")).toBe(false);
    expect(isPublicIpAddress("::ffff:8.8.8.8")).toBe(true);
    expect(isPublicIpAddress("::")).toBe(false);
  });

  it("rejects IPv6-mapped IPv4 private addresses", () => {
    expect(isPublicIpAddress("::ffff:127.0.0.1")).toBe(false);
    expect(isPublicIpAddress("::ffff:192.168.0.1")).toBe(false);
  });

  it("normalizes bracketed IPv6 hostnames", () => {
    expect(isPublicIpAddress("[2001:4860:4860::8888]")).toBe(true);
    expect(isPublicIpAddress("[fc00::1]")).toBe(false);
  });
});
