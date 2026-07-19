/**
 * Browser SpeechRecognition for low-latency interim captions while Gemini Live
 * ASR catches up (Live often only emits input transcription at end-of-turn).
 */

export type BrowserAsr = {
  stop: () => void;
  /** Clear committed text for the next user turn. */
  resetTurn: () => void;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: ArrayLike<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function browserAsrSupported(): boolean {
  return getSpeechRecognitionCtor() !== null;
}

type Options = {
  lang?: string;
  /** Called with the best current caption for this turn (committed + interim). */
  onUpdate: (text: string) => void;
  isActive: () => boolean;
};

/**
 * Start continuous Korean ASR for live captions. Returns null if unsupported.
 * Safe to call after getUserMedia — Chrome reuses the granted mic permission.
 */
export function startBrowserAsr(options: Options): BrowserAsr | null {
  const Ctor = getSpeechRecognitionCtor();
  if (!Ctor) return null;

  const { onUpdate, isActive } = options;
  const lang = options.lang ?? "ko-KR";
  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  let stopped = false;
  let committed = "";
  let restartTimer: ReturnType<typeof setTimeout> | null = null;

  const emit = (interim: string) => {
    const text = `${committed}${interim}`.replace(/\s+/g, " ").trim();
    if (text) onUpdate(text);
  };

  recognition.onresult = (ev) => {
    if (stopped || !isActive()) return;
    let interim = "";
    for (let i = ev.resultIndex; i < ev.results.length; i++) {
      const result = ev.results[i]!;
      const piece = result[0]?.transcript ?? "";
      if (!piece) continue;
      if (result.isFinal) {
        committed = `${committed}${piece}`;
      } else {
        interim += piece;
      }
    }
    emit(interim);
  };

  recognition.onerror = (ev) => {
    // `no-speech` / `aborted` are normal; keep trying while the session is live.
    if (stopped || !isActive()) return;
    if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
      stopped = true;
    }
  };

  recognition.onend = () => {
    if (stopped || !isActive()) return;
    // Chrome stops continuous recognition periodically — restart quickly.
    restartTimer = setTimeout(() => {
      restartTimer = null;
      if (stopped || !isActive()) return;
      try {
        recognition.start();
      } catch {
        /* already started */
      }
    }, 120);
  };

  try {
    recognition.start();
  } catch {
    return null;
  }

  return {
    resetTurn: () => {
      committed = "";
    },
    stop: () => {
      stopped = true;
      if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        try {
          recognition.stop();
        } catch {
          /* ignore */
        }
      }
    },
  };
}
