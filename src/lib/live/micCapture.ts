/**
 * Captures mic PCM at 16 kHz and POSTs batched base64 frames to Live audio.
 * Batching cuts request spam vs one fetch per ScriptProcessor callback.
 * Noise filtering is handled by Live VAD (start sensitivity + prefix padding).
 */
import {
  LIVE_INPUT_RATE,
  arrayBufferToBase64,
  floatTo16BitPCM,
} from "@/lib/live/audio";

/** Smaller batches = snappier Live ASR; still avoids one fetch per audio callback. */
const BATCH_MS = 60;

export type MicCapture = {
  stop: () => void;
};

type Options = {
  sessionId: string;
  /** Return false to drop frames (session replaced / ended). */
  isActive: () => boolean;
  /**
   * Return false to mute uplink (e.g. while partner audio plays through
   * speakers — otherwise the mic hears the partner and ASR attributes it to you).
   */
  shouldSend?: () => boolean;
};

export async function startMicCapture(options: Options): Promise<MicCapture> {
  const { sessionId, isActive, shouldSend } = options;
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  });

  const ctx = new AudioContext({ sampleRate: LIVE_INPUT_RATE });
  if (ctx.state === "suspended") await ctx.resume();

  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(4096, 1, 1);
  const pending: ArrayBuffer[] = [];
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const postBatch = (chunks: ArrayBuffer[]) => {
    if (!chunks.length || !isActive()) return;
    if (shouldSend && !shouldSend()) return;
    const total = chunks.reduce((n, c) => n + c.byteLength, 0);
    const merged = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }
    void fetch(`/api/live/session/${sessionId}/audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ audio: arrayBufferToBase64(merged.buffer) }),
    }).catch(() => {
      /* session may be closing */
    });
  };

  const flushPending = () => {
    flushTimer = null;
    if (!pending.length) return;
    if (shouldSend && !shouldSend()) {
      pending.length = 0;
      return;
    }
    const chunks = pending.splice(0, pending.length);
    postBatch(chunks);
  };

  processor.onaudioprocess = (ev) => {
    if (stopped || !isActive()) return;
    if (shouldSend && !shouldSend()) {
      // Drop speaker-echo frames; don't let them queue for later send.
      pending.length = 0;
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      return;
    }
    pending.push(floatTo16BitPCM(ev.inputBuffer.getChannelData(0)));
    if (!flushTimer) {
      flushTimer = setTimeout(flushPending, BATCH_MS);
    }
  };

  source.connect(processor);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  processor.connect(mute);
  mute.connect(ctx.destination);

  return {
    stop: () => {
      stopped = true;
      if (flushTimer) {
        clearTimeout(flushTimer);
        flushTimer = null;
      }
      flushPending();
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((t) => t.stop());
      void ctx.close();
    },
  };
}
