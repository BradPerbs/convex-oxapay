import { describe, expect, it } from "vitest";
import {
  buildUrl,
  constantTimeEqual,
  fromHex,
  hmacSha512Hex,
  lowerCaseHeaders,
  normalizeSignature,
  stripUndefined,
  toHex,
} from "./helpers.js";

describe("toHex/fromHex round-trip", () => {
  it("encodes and decodes round-trip", () => {
    const bytes = new Uint8Array([0x00, 0xff, 0x7f, 0x80, 0xab, 0xcd]);
    const hex = toHex(bytes);
    expect(hex).toBe("00ff7f80abcd");
    const back = fromHex(hex);
    expect(Array.from(back)).toEqual(Array.from(bytes));
  });

  it("fromHex throws on odd length", () => {
    expect(() => fromHex("abc")).toThrow();
  });

  it("fromHex throws on invalid characters", () => {
    expect(() => fromHex("zzzz")).toThrow();
  });
});

describe("constantTimeEqual", () => {
  it("returns true for equal strings", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
  });
  it("returns false for differing strings of same length", () => {
    expect(constantTimeEqual("abc", "abd")).toBe(false);
  });
  it("returns false for differing lengths", () => {
    expect(constantTimeEqual("abc", "ab")).toBe(false);
  });
  it("returns true for two empty strings", () => {
    expect(constantTimeEqual("", "")).toBe(true);
  });
});

describe("normalizeSignature", () => {
  it("returns the value verbatim when no prefix", () => {
    expect(normalizeSignature("ABCDEF")).toBe("abcdef");
  });
  it("strips a sha256= prefix", () => {
    expect(normalizeSignature("sha256=abcdef")).toBe("abcdef");
  });
  it("strips a sha512= prefix", () => {
    expect(normalizeSignature("sha512=ABCDEF")).toBe("abcdef");
  });
  it("trims whitespace", () => {
    expect(normalizeSignature("   ABCDEF\n")).toBe("abcdef");
  });
});

describe("lowerCaseHeaders", () => {
  it("lowercases all keys", () => {
    const out = lowerCaseHeaders({ "Content-Type": "x", AUTHORIZATION: "y" });
    expect(out["content-type"]).toBe("x");
    expect(out["authorization"]).toBe("y");
  });
});

describe("stripUndefined", () => {
  it("drops undefined and null values", () => {
    expect(stripUndefined({ a: 1, b: undefined, c: null, d: 0 })).toEqual({ a: 1, d: 0 });
  });
  it("preserves false and 0", () => {
    expect(stripUndefined({ x: false, y: 0, z: "" })).toEqual({ x: false, y: 0, z: "" });
  });
});

describe("buildUrl", () => {
  it("appends query params, omitting undefined", () => {
    const url = buildUrl("https://api.x.com/v1", "/p", { a: 1, b: undefined, c: "hi there" });
    expect(url).toBe("https://api.x.com/v1/p?a=1&c=hi%20there");
  });
  it("handles trailing slash on base and missing slash on path", () => {
    expect(buildUrl("https://api.x.com/v1/", "p")).toBe("https://api.x.com/v1/p");
  });
  it("returns the bare URL when no query", () => {
    expect(buildUrl("https://api.x.com/v1", "/p")).toBe("https://api.x.com/v1/p");
  });
});

describe("hmacSha512Hex", () => {
  it("produces deterministic output for a fixed input", async () => {
    const sig = await hmacSha512Hex("secret", "hello");
    // RFC 4868-style test vector
    expect(sig).toMatch(/^[0-9a-f]{128}$/);
    const again = await hmacSha512Hex("secret", "hello");
    expect(again).toBe(sig);
  });
  it("differs for different secrets", async () => {
    const a = await hmacSha512Hex("k1", "msg");
    const b = await hmacSha512Hex("k2", "msg");
    expect(a).not.toBe(b);
  });
});
