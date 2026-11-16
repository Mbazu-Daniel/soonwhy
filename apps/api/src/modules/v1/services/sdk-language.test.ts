import { describe, expect, it } from "vitest";
import { languageFromSdk } from "./sdk-language";

describe("languageFromSdk", () => {
  it("names the common OpenTelemetry SDK languages", () => {
    expect(languageFromSdk("nodejs")).toBe("Node.js");
    expect(languageFromSdk("python")).toBe("Python");
    expect(languageFromSdk("dotnet")).toBe(".NET");
  });

  it("ignores case and spaces", () => {
    expect(languageFromSdk("  Java ")).toBe("Java");
  });

  it("returns null for unknown or missing values", () => {
    expect(languageFromSdk("cobol")).toBeNull();
    expect(languageFromSdk("")).toBeNull();
    expect(languageFromSdk(undefined)).toBeNull();
    expect(languageFromSdk(42)).toBeNull();
  });
});
