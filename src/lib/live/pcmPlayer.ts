/**
 * Schedules PCM16 (24 kHz) chunks on an AudioContext without overlap.
 * `flush()` stops queued sources and bumps an epoch so in-flight awaits drop.
 */
import {
  LIVE_OUTPUT_RATE,
  base64ToArrayBuffer,
  pcm16ToFloat32,
} from "@/lib/live/audio";

export type PcmPlayer = {
  playBase64: (base64: string) => Promise<void>;
  flush: () => void;
  dispose: () => void;
  /** True while speaker audio is queued or actively playing. */
  isBusy: () => boolean;
  /** Approx ms until the playback queue drains (0 if idle). */
  queuedMsRemaining: () => number;
};

export function createPcmPlayer(): PcmPlayer {
  let ctx: AudioContext | null = null;
  let nextPlayTime = 0;
  let epoch = 0;
  let active: AudioBufferSourceNode[] = [];

  const queuedMsRemaining = () => {
    if (!ctx) return 0;
    return Math.max(0, (nextPlayTime - ctx.currentTime) * 1000);
  };

  const isBusy = () => active.length > 0 || queuedMsRemaining() > 40;

  const flush = () => {
    epoch += 1;
    for (const src of active) {
      try {
        src.stop();
      } catch {
        /* already stopped */
      }
    }
    active = [];
    nextPlayTime = ctx?.currentTime ?? 0;
  };

  const dispose = () => {
    flush();
    void ctx?.close();
    ctx = null;
    nextPlayTime = 0;
  };

  const playBase64 = async (base64: string) => {
    const myEpoch = epoch;
    ctx ??= new AudioContext({ sampleRate: LIVE_OUTPUT_RATE });
    if (ctx.state === "suspended") await ctx.resume();
    if (myEpoch !== epoch) return;

    const float32 = pcm16ToFloat32(base64ToArrayBuffer(base64));
    const buffer = ctx.createBuffer(1, float32.length, LIVE_OUTPUT_RATE);
    buffer.copyToChannel(new Float32Array(float32), 0);
    if (myEpoch !== epoch) return;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, nextPlayTime);
    src.onended = () => {
      active = active.filter((s) => s !== src);
    };
    active.push(src);
    src.start(startAt);
    nextPlayTime = startAt + buffer.duration;
  };

  return { playBase64, flush, dispose, isBusy, queuedMsRemaining };
}
