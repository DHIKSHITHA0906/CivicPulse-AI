import { useEffect, useRef, useState } from "react";
import { Mic, Square, MapPin, CheckCircle2, AlertTriangle, Send, RotateCcw, ShieldAlert, Loader2, Trash2, Copy, Check } from "lucide-react";
import { LANGUAGES, t } from "../i18n/strings";
import { DISTRICTS } from "../constants";
import { submitRequest } from "../api";
import LiveWaveform from "../components/LiveWaveform";
import AudioPlayer from "../components/AudioPlayer";
import SeverityMeter from "../components/SeverityMeter";
import ConfidenceGauge from "../components/ConfidenceGauge";
import { CATEGORY_LABEL, humanize } from "../components/labels";

const STATUS = { IDLE: "idle", RECORDING: "recording", SUBMITTING: "submitting", SUCCESS: "success", ERROR: "error" };
const ERROR_KIND = { MIC: "mic", SUBMIT: "submit" };
const MAX_RECORD_SECONDS = 120; // keeps the base64 payload a sensible size

// BCP-47 tags for the Web Speech API — one per language this form supports.
const SPEECH_RECOGNITION_LANG = { ta: "ta-IN", kn: "kn-IN", hi: "hi-IN", en: "en-IN" };
const SpeechRecognitionCtor =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : undefined;

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function formatClock(seconds) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function Submit() {
  const [lang, setLang] = useState("ta"); // Tamil is the primary demo language.
  const [text, setText] = useState("");
  const [audioBase64, setAudioBase64] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [peaks, setPeaks] = useState(null);
  const [recordedDuration, setRecordedDuration] = useState(0);
  const [analyser, setAnalyser] = useState(null);
  const [locationKnown, setLocationKnown] = useState(false);
  const [district, setDistrict] = useState("");
  const [status, setStatus] = useState(STATUS.IDLE);
  const [errorKind, setErrorKind] = useState(ERROR_KIND.SUBMIT);
  const [result, setResult] = useState(null);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [copied, setCopied] = useState(false);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const audioUrlRef = useRef(null);
  const audioCtxRef = useRef(null);
  const peaksRef = useRef([]);
  const startedAtRef = useRef(0);

  // Best-effort location check on mount; falls back to the district dropdown
  // per Section 7 ("Missing location → provide a district dropdown fallback").
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      () => setLocationKnown(true),
      () => setLocationKnown(false),
      { timeout: 4000 }
    );
  }, []);

  function releaseAudioUrl() {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }

  function teardownAudioGraph() {
    audioCtxRef.current?.close?.().catch(() => {});
    audioCtxRef.current = null;
    setAnalyser(null);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      peaksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        // Local playback is available the moment recording stops; the
        // base64 payload (what api.js sends) follows as soon as it's encoded.
        releaseAudioUrl();
        const url = URL.createObjectURL(blob);
        audioUrlRef.current = url;
        setAudioUrl(url);
        setAudioBase64(await blobToBase64(blob));
        stream.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
      };

      // Live level meter only — reads the mic stream through Web Audio to
      // draw the waveform. The recording itself is still MediaRecorder.
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        try {
          const ctx = new AudioCtx();
          const source = ctx.createMediaStreamSource(stream);
          const node = ctx.createAnalyser();
          node.fftSize = 1024;
          source.connect(node);
          audioCtxRef.current = ctx;
          setAnalyser(node);
        } catch {
          /* Waveform falls back to an idle line; recording is unaffected. */
        }
      }

      recorder.start();
      mediaRecorderRef.current = recorder;
      startedAtRef.current = performance.now();
      setRecordSeconds(0);
      timerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
      setStatus(STATUS.RECORDING);

      // Live speech-to-text purely in the browser (Web Speech API) so the
      // recorded message shows up as editable text in the same box the
      // person can already type in. This never touches the request payload
      // or api.js — audio_base64 is still built and sent exactly as before;
      // this only pre-fills `text`, which the backend already accepts.
      if (SpeechRecognitionCtor) {
        const recognition = new SpeechRecognitionCtor();
        recognition.lang = SPEECH_RECOGNITION_LANG[lang] ?? "en-IN";
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.onresult = (event) => {
          let finalTranscript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript;
          }
          if (finalTranscript.trim()) {
            setText((prev) => (prev ? `${prev} ${finalTranscript}`.trim() : finalTranscript.trim()));
          }
        };
        recognition.onerror = () => {
          /* Non-fatal: recording/playback still work without a transcript. */
        };
        recognition.start();
        recognitionRef.current = recognition;
      }
    } catch {
      setErrorKind(ERROR_KIND.MIC);
      setStatus(STATUS.ERROR);
    }
  }

  function stopRecording() {
    setPeaks(peaksRef.current.slice());
    setRecordedDuration((performance.now() - startedAtRef.current) / 1000);
    mediaRecorderRef.current?.stop();
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    clearInterval(timerRef.current);
    teardownAudioGraph();
    setStatus(STATUS.IDLE);
  }

  // Discards the current take and immediately starts a fresh one — the
  // "record again if I don't like it" flow.
  function reRecord() {
    releaseAudioUrl();
    setAudioUrl(null);
    setAudioBase64(null);
    setPeaks(null);
    startRecording();
  }

  function discardRecording() {
    releaseAudioUrl();
    setAudioUrl(null);
    setAudioBase64(null);
    setPeaks(null);
  }

  // Stop automatically at the cap so a forgotten recording can't grow unbounded.
  useEffect(() => {
    if (status === STATUS.RECORDING && recordSeconds >= MAX_RECORD_SECONDS) stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordSeconds, status]);

  useEffect(
    () => () => {
      clearInterval(timerRef.current);
      recognitionRef.current?.stop();
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      audioCtxRef.current?.close?.().catch(() => {});
      releaseAudioUrl();
    },
    []
  );

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus(STATUS.SUBMITTING);
    const { data, error } = await submitRequest({
      text: text || undefined,
      audio_base64: audioBase64 || undefined,
      language_hint: lang,
    });
    if (error || !data) {
      setErrorKind(ERROR_KIND.SUBMIT);
      setStatus(STATUS.ERROR);
      return;
    }
    setResult(data);
    setStatus(STATUS.SUCCESS);
  }

  function resetForm() {
    setText("");
    releaseAudioUrl();
    setAudioUrl(null);
    setAudioBase64(null);
    setPeaks(null);
    setDistrict("");
    setResult(null);
    setStatus(STATUS.IDLE);
  }

  async function copyReference() {
    try {
      await navigator.clipboard.writeText(result.request_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* Clipboard may be blocked; the ID stays selectable on screen. */
    }
  }

  const isRecording = status === STATUS.RECORDING;
  const hasRecording = !isRecording && !!audioUrl;
  const canSubmit = (text.trim().length > 0 || audioBase64) && status !== STATUS.SUBMITTING && !isRecording;

  if (status === STATUS.SUCCESS && result) {
    const languageName = LANGUAGES.find((l) => l.code === result.language)?.name ?? result.language;
    const showTranslation = result.translated_text && result.translated_text !== result.original_text;
    return (
      <div className="submit-page">
        <div className="submit-layout">
          <div className="submit-intro fade-in">
            <span className="success-mark">
              <CheckCircle2 size={22} strokeWidth={2} />
            </span>
            <h1>{t(lang, "submitSuccessTitle")}</h1>
            <div className="ref-line ref-line--stack">
              <span className="ref-line__label">{t(lang, "referenceId")}</span>
              <code className="ref-line__id">{result.request_id}</code>
              <button type="button" className="btn btn--ghost btn--small" onClick={copyReference} aria-label="Copy reference ID">
                {copied ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={2.2} />}
              </button>
            </div>
          </div>

          <div className="submit-card result-card fade-in-delay">
            {result.needs_review && (
              <div className="alert alert--notice" role="status">
                <ShieldAlert size={16} strokeWidth={2.2} />
                <span>{t(lang, "reviewNotice")}</span>
              </div>
            )}

            <div className="result-card__filed">
              <span className="result-card__filed-label">{t(lang, "filedUnder")}</span>
              <h2 className="result-card__category">{CATEGORY_LABEL[result.category] ?? humanize(result.category)}</h2>
              <p className="result-card__sub">{humanize(result.sub_category)}</p>
            </div>

            <figure className="report-quote">
              <figcaption>{t(lang, "originalReport")}</figcaption>
              <blockquote>{result.original_text}</blockquote>
              {showTranslation && (
                <p className="report-quote__translation">
                  <span>{t(lang, "englishTranslation")}</span>
                  {result.translated_text}
                </p>
              )}
            </figure>

            {audioUrl && (
              <div className="result-card__voice">
                <span className="result-card__voice-label">{t(lang, "yourVoiceMessage")}</span>
                <AudioPlayer src={audioUrl} duration={recordedDuration} peaks={peaks} label={t(lang, "yourVoiceMessage")} />
              </div>
            )}

            <div className="detail-figures">
              <div className="detail-figure">
                <span className="detail-figure__label">{t(lang, "severity")}</span>
                <SeverityMeter severity={result.severity} />
              </div>
              <div className="detail-figure">
                <span className="detail-figure__label">{t(lang, "affectedPopulation")}</span>
                <span className="detail-figure__value">
                  {result.affected_population != null ? result.affected_population.toLocaleString() : t(lang, "notEstimated")}
                </span>
              </div>
              <div className="detail-figure detail-figure--gauge">
                <ConfidenceGauge value={result.confidence} label={t(lang, "confidence")} size={46} />
                <span className="detail-figure__label">{t(lang, "confidence")}</span>
              </div>
            </div>

            <dl className="result-grid">
              <dt>{t(lang, "filterDistrict")}</dt>
              <dd>
                <MapPin size={13} strokeWidth={2.2} className="inline-icon" />
                {result.district}
              </dd>
              <dt>{t(lang, "detectedLanguage")}</dt>
              <dd>{languageName}</dd>
            </dl>

            <button type="button" className="btn btn--primary btn--block" onClick={resetForm}>
              <RotateCcw size={16} strokeWidth={2.2} />
              {t(lang, "submitAnother")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="submit-page">
      <div className="submit-layout">
        <div className="submit-intro fade-in">
          <h1>{t(lang, "submitTitle")}</h1>
          <p className="submit-subtitle">{t(lang, "submitSubtitle")}</p>
        </div>

        <form className="submit-card fade-in-delay" onSubmit={handleSubmit}>
          <div className="lang-pills" role="tablist" aria-label="Language">
            {LANGUAGES.map((l) => (
              <button
                type="button"
                key={l.code}
                role="tab"
                aria-selected={lang === l.code}
                className={`lang-pill${lang === l.code ? " lang-pill--active" : ""}`}
                onClick={() => setLang(l.code)}
                disabled={isRecording}
              >
                {l.label}
              </button>
            ))}
          </div>

          <label className="field-label" htmlFor="issue-text">
            {t(lang, "textLabel")}
          </label>
          <textarea
            id="issue-text"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t(lang, "textPlaceholder")}
          />

          <div className={`recorder${isRecording ? " recorder--live" : hasRecording ? " recorder--ready" : ""}`}>
            {isRecording ? (
              <>
                <button type="button" className="rec-btn rec-btn--stop" onClick={stopRecording} aria-label={t(lang, "recordStop")}>
                  <Square size={16} strokeWidth={2.2} fill="currentColor" />
                </button>
                <div className="recorder__live">
                  <div className="recorder__status">
                    <span className="rec-dot" aria-hidden="true" />
                    <span>{t(lang, "recording")}</span>
                    <span className="recorder__timer" role="timer" aria-live="off">
                      {formatClock(recordSeconds)}
                      <span className="recorder__timer-max"> / {formatClock(MAX_RECORD_SECONDS)}</span>
                    </span>
                  </div>
                  <LiveWaveform analyser={analyser} peaksRef={peaksRef} />
                  <div className="recorder__progress" aria-hidden="true">
                    <span style={{ width: `${Math.min(100, (recordSeconds / MAX_RECORD_SECONDS) * 100)}%` }} />
                  </div>
                </div>
              </>
            ) : hasRecording ? (
              <div className="recorder__ready">
                <div className="recorder__ready-head">
                  <CheckCircle2 size={15} strokeWidth={2.2} />
                  {t(lang, "recordedReady")}
                </div>
                <AudioPlayer src={audioUrl} duration={recordedDuration} peaks={peaks} label={t(lang, "yourVoiceMessage")} />
                <div className="recorder__actions">
                  <button type="button" className="btn btn--ghost btn--small" onClick={reRecord}>
                    <RotateCcw size={14} strokeWidth={2.2} />
                    {t(lang, "reRecord")}
                  </button>
                  <button type="button" className="btn btn--quiet btn--small" onClick={discardRecording}>
                    <Trash2 size={14} strokeWidth={2.2} />
                    {t(lang, "discard")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button type="button" className="rec-btn" onClick={startRecording} aria-label={t(lang, "recordStart")}>
                  <Mic size={22} strokeWidth={2} />
                </button>
                <div className="recorder__copy">
                  <p className="recorder__title">{t(lang, "recordStart")}</p>
                  <p className="recorder__hint">{t(lang, "recordHint")}</p>
                </div>
              </>
            )}
          </div>

          {isRecording && !SpeechRecognitionCtor && <p className="field-help">{t(lang, "speechUnsupported")}</p>}

          {!locationKnown && (
            <div className="field-group">
              <label className="field-label field-label--icon" htmlFor="district-select">
                <MapPin size={14} strokeWidth={2.2} />
                {t(lang, "districtLabel")}
              </label>
              <p className="field-help">{t(lang, "districtHelp")}</p>
              <select id="district-select" value={district} onChange={(e) => setDistrict(e.target.value)}>
                <option value="" disabled>
                  {t(lang, "districtLabel")}
                </option>
                {DISTRICTS.map((d) => (
                  <option key={d.district_id} value={d.district_id}>
                    {d.name} ({d.state})
                  </option>
                ))}
              </select>
            </div>
          )}

          {status === STATUS.ERROR && (
            <div className="alert alert--error" role="alert">
              <AlertTriangle size={16} strokeWidth={2.2} />
              <span>
                {errorKind === ERROR_KIND.MIC ? (
                  <>
                    <strong>Microphone unavailable</strong>
                    <br />
                    We couldn't access your microphone. Check your browser's permission for this site, or type your report instead.
                  </>
                ) : (
                  <>
                    <strong>{t(lang, "submitErrorTitle")}</strong>
                    <br />
                    {t(lang, "submitErrorBody")}
                  </>
                )}
              </span>
            </div>
          )}

          <button type="submit" className="btn btn--primary btn--block" disabled={!canSubmit}>
            {status === STATUS.SUBMITTING ? (
              <>
                <Loader2 size={16} strokeWidth={2.2} className="spin" />
                {t(lang, "submitting")}
              </>
            ) : (
              <>
                <Send size={16} strokeWidth={2.2} />
                {t(lang, "submit")}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
