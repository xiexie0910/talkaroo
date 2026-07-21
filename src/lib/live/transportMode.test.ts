import { describe, expect, it } from "vitest";
import { resolveLiveTransportMode } from "@/lib/live/transportMode";

describe("resolveLiveTransportMode", () => {
  it("uses WebSocket on deployed hostnames", () => {
    expect(
      resolveLiveTransportMode({
        hostname: "talkaroo-pi.vercel.app",
        supportsDuplexFetch: true,
      }),
    ).toBe("websocket");
  });

  it("uses WebSocket on localhost (parity with production via vercel dev)", () => {
    expect(
      resolveLiveTransportMode({
        hostname: "localhost",
        supportsDuplexFetch: true,
      }),
    ).toBe("websocket");
  });

  it("falls back to HTTP on localhost when WebSocket fails", () => {
    expect(
      resolveLiveTransportMode({
        hostname: "localhost",
        supportsDuplexFetch: true,
        websocketFailed: true,
      }),
    ).toBe("legacy-http");
  });

  it("falls back to duplex on production when WebSocket fails", () => {
    expect(
      resolveLiveTransportMode({
        hostname: "talkaroo-pi.vercel.app",
        supportsDuplexFetch: true,
        websocketFailed: true,
      }),
    ).toBe("duplex");
  });

  it("never auto-picks split HTTP on production after WS fail", () => {
    expect(
      resolveLiveTransportMode({
        hostname: "talkaroo-pi.vercel.app",
        supportsDuplexFetch: false,
        websocketFailed: true,
      }),
    ).not.toBe("legacy-http");
  });

  it("allows duplex on localhost only when NEXT_PUBLIC_LIVE_DUPLEX=1 after WS fail", () => {
    expect(
      resolveLiveTransportMode({
        hostname: "localhost",
        supportsDuplexFetch: true,
        websocketFailed: true,
        liveDuplexFlag: "1",
      }),
    ).toBe("duplex");
  });

  it("forces legacy-http when NEXT_PUBLIC_LIVE_HTTP=1", () => {
    expect(
      resolveLiveTransportMode({
        hostname: "talkaroo-pi.vercel.app",
        supportsDuplexFetch: true,
        liveHttpFlag: "1",
      }),
    ).toBe("legacy-http");
  });

  it("respects NEXT_PUBLIC_LIVE_WS=0 → duplex on production", () => {
    expect(
      resolveLiveTransportMode({
        hostname: "talkaroo-pi.vercel.app",
        liveWsFlag: "0",
        supportsDuplexFetch: true,
      }),
    ).toBe("duplex");
  });

  it("respects NEXT_PUBLIC_LIVE_WS=0 → HTTP on localhost", () => {
    expect(
      resolveLiveTransportMode({
        hostname: "localhost",
        liveWsFlag: "0",
        supportsDuplexFetch: true,
      }),
    ).toBe("legacy-http");
  });
});
