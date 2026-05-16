import { describe, expect, it } from "vitest";
import { OxaPayClient } from "./http.js";
import { OxaPayApiError } from "./errors.js";

function mockFetch(handler: (req: Request) => Response | Promise<Response>) {
  return ((input: Request | string, init?: RequestInit) => {
    const req = typeof input === "string" ? new Request(input, init) : input;
    return Promise.resolve(handler(req));
  }) as typeof fetch;
}

const envelope = (data: unknown, opts: { status?: number; message?: string; error?: unknown } = {}) =>
  JSON.stringify({
    data,
    message: opts.message ?? "ok",
    error: opts.error ?? {},
    status: opts.status ?? 200,
    version: "1.0.0",
  });

describe("OxaPayClient — request shaping", () => {
  it("sends merchant_api_key header on /payment/* calls", async () => {
    let captured: Request | null = null;
    const client = new OxaPayClient({
      merchantApiKey: "MERCHANT",
      fetch: mockFetch((req) => {
        captured = req;
        return new Response(
          envelope({ track_id: "tk", payment_url: "https://pay/x", expired_at: 1, date: 0 }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }),
    });
    await client.createInvoice({ amount: 1 });
    expect(captured).toBeTruthy();
    expect(captured!.headers.get("merchant_api_key")).toBe("MERCHANT");
    expect(captured!.method).toBe("POST");
  });

  it("encodes query string for GET", async () => {
    let url = "";
    const client = new OxaPayClient({
      merchantApiKey: "k",
      fetch: mockFetch((req) => {
        url = req.url;
        return new Response(envelope({ list: [], meta: { page: 1, last_page: 0, total: 0 } }), {
          status: 200,
        });
      }),
    });
    await client.listPayments({ status: "paid", page: 2 });
    expect(url).toContain("status=paid");
    expect(url).toContain("page=2");
  });

  it("does not send a body on GET", async () => {
    let body: string | null = "non-null";
    const client = new OxaPayClient({
      merchantApiKey: "k",
      fetch: mockFetch(async (req) => {
        body = req.body ? await req.text() : null;
        return new Response(envelope({ list: ["BTC"] }), { status: 200 });
      }),
    });
    await client.acceptedCurrencies();
    expect(body).toBe(null);
  });

  it("requires a key for authenticated endpoints", async () => {
    const client = new OxaPayClient({});
    await expect(client.createInvoice({ amount: 1 })).rejects.toThrow(/merchantApiKey/);
  });

  it("does not require a key for /common/* endpoints", async () => {
    let header = "missing";
    const client = new OxaPayClient({
      fetch: mockFetch((req) => {
        header = req.headers.get("merchant_api_key") ?? "missing";
        return new Response(envelope({ status: "OK" }), { status: 200 });
      }),
    });
    const res = await client.monitor();
    expect(header).toBe("missing");
    expect(res.status).toBe("OK");
  });

  it("throws OxaPayApiError on a non-2xx envelope status (despite wire 200)", async () => {
    const client = new OxaPayClient({
      merchantApiKey: "k",
      fetch: mockFetch(
        () =>
          new Response(
            envelope({}, { status: 401, message: "invalid key", error: { message: "bad key" } }),
            { status: 200 },
          ),
      ),
    });
    await expect(client.createInvoice({ amount: 1 })).rejects.toMatchObject({
      name: "OxaPayApiError",
      status: 401,
    });
  });

  it("trusts envelope.status when wire HTTP says 403 (Cloudflare quirk)", async () => {
    const client = new OxaPayClient({
      merchantApiKey: "k",
      fetch: mockFetch(
        () =>
          new Response(
            envelope({}, { status: 401, message: "invalid", error: { message: "bad" } }),
            { status: 403 },
          ),
      ),
    });
    try {
      await client.createInvoice({ amount: 1 });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(OxaPayApiError);
      expect((err as OxaPayApiError).status).toBe(401);
      expect((err as OxaPayApiError).httpStatus).toBe(403);
    }
  });

  it("normalises balance to {available, pending} even if API returns flat numbers", async () => {
    const client = new OxaPayClient({
      generalApiKey: "k",
      fetch: mockFetch(
        () => new Response(envelope({ BTC: 0.5, USDT: { available: 100, pending: 5 } }), { status: 200 }),
      ),
    });
    const bal = await client.balance();
    expect(bal.BTC).toEqual({ available: 0.5, pending: 0 });
    expect(bal.USDT).toEqual({ available: 100, pending: 5 });
  });
});
