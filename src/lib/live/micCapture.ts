/**
 * Captures mic PCM at 16 kHz and sends batched base64 frames to Live.
 * Batching cuts spam vs one send per ScriptProcessor callback.
 * Noise filtering is handled by Live VAD (start sensitivity + prefix padding).
 */
import {
  LIVE_INPUT_RATE,
  arrayBufferToBase64,
  floatTo16BitPCM,
} from "@/lib/live/audio";

/** Smaller batches = snappier Live ASR; still avoids one send per audio callback. */
const BATCH_MS = 60;

export type MicCapture = {
  stop: () => void;
};

type Options = {
  /** Deliver a base64 PCM batch (WebSocket or HTTP POST). */
  sendAudio: (base64Pcm: string) => void;
  /** Return false to drop frames (session replaced / ended). */
  isActive: () => boolean;
  /**
   * Return false to mute uplink (e.g. while partner audio plays through
   * speakers — otherwise the mic hears the partner and ASR attributes it to you).
   */
  shouldSend?: () => boolean;
};

export async function startMicCapture(options: Options): Promise<MicCapture> {
  const { sendAudio, isActive, shouldSend } = options;
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
    try {
      sendAudio(arrayBufferToBase64(merged.buffer));
    } catch {
      /* session may be closing */
    }
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
