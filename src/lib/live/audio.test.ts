import { describe, expect, it } from "vitest";
import {
  LIVE_INPUT_RATE,
  floatToLiveInputPcm,
  pcm16ToFloat32,
  resampleFloat32,
} from "@/lib/live/audio";

describe("resampleFloat32", () => {
  it("returns the same buffer when rates match", () => {
    const input = new Float32Array([0.1, -0.2, 0.3]);
    expect(resampleFloat32(input, 16_000, 16_000)).toBe(input);
  });

  it("downsamples 48 kHz to 16 kHz at 1/3 length", () => {
    const input = new Float32Array(480);
    for (let i = 0; i < input.length; i++) input[i] = Math.sin(i / 10);
    const out = resampleFloat32(input, 48_000, 16_000);
    expect(out.length).toBe(160);
  });
});

describe("floatToLiveInputPcm", () => {
  it("emits 16-bit PCM length matching 16 kHz after resample", () => {
    const input = new Float32Array(480);
    input.fill(0.25);
    const pcm = floatToLiveInputPcm(input, 48_000);
    expect(pcm.byteLength).toBe(160 * 2);
    const floats = pcm16ToFloat32(pcm);
    expect(floats.length).toBe(160);
  });

  it("skips resample when already at live input rate", () => {
    const input = new Float32Array(100);
    input.fill(0.5);
    const pcm = floatToLiveInputPcm(input, LIVE_INPUT_RATE);
    expect(pcm.byteLength).toBe(200);
  });
});
