import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

const BARS = 56;

function formatTime(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Downsamples the levels captured while recording into a fixed number of
// bars (peak per bucket), normalized so quiet recordings still read clearly.
function toBars(peaks) {
  if (!peaks?.length) return new Array(BARS).fill(0.25);
  const size = peaks.length / BARS;
  const bars = Array.from({ length: BARS }, (_, i) => {
    const from = Math.floor(i * size);
    const to = Math.max(from + 1, Math.floor((i + 1) * size));
    let max = 0;
    for (let j = from; j < to && j < peaks.length; j += 1) max = Math.max(max, peaks[j]);
    return max;
  });
  const top = Math.max(...bars, 0.001);
  return bars.map((b) => Math.max(0.1, b / top));
}

// Custom player for the just-recorded voice message. It plays the local
// object URL only — the audio that gets submitted is still the
// audio_base64 built in Submit.jsx.
export default function AudioPlayer({ src, duration = 0, peaks, label = "Voice message" }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [metaDuration, setMetaDuration] = useState(0);
  const bars = useMemo(() => toBars(peaks), [peaks]);

  const total = metaDuration > 0 ? metaDuration : duration;
  const progress = total > 0 ? Math.min(1, current / total) : 0;

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
    setMetaDuration(0);
  }, [src]);

  function onLoadedMetadata() {
    const audio = audioRef.current;
    if (!audio) return;
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      setMetaDuration(audio.duration);
      return;
    }
    // MediaRecorder output (webm) often reports an infinite duration until
    // the browser has scanned to the end once, which also blocks seeking.
    // Jumping to a huge time and back forces it to compute the real length.
    const settle = () => {
      audio.removeEventListener("timeupdate", settle);
      audio.currentTime = 0;
      if (Number.isFinite(audio.duration) && audio.duration > 0) setMetaDuration(audio.duration);
    };
    audio.addEventListener("timeupdate", settle);
    audio.currentTime = 1e101;
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      if (progress >= 1) audio.currentTime = 0;
      audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  }

  function seekTo(ratio) {
    const audio = audioRef.current;
    if (!audio || !(total > 0)) return;
    const clamped = Math.max(0, Math.min(1, ratio));
    if (Number.isFinite(audio.duration)) audio.currentTime = clamped * audio.duration;
    setCurrent(clamped * total);
  }

  function onBarsClick(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    seekTo((e.clientX - rect.left) / rect.width);
  }

  function onBarsKey(e) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      seekTo(progress + 0.05);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      seekTo(progress - 0.05);
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggle();
    }
  }

  return (
    <div className="audio-player">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCurrent(0);
        }}
      />
      <button type="button" className="audio-player__btn" onClick={toggle} aria-label={playing ? `Pause ${label}` : `Play ${label}`}>
        {playing ? <Pause size={18} strokeWidth={2.2} fill="currentColor" /> : <Play size={18} strokeWidth={2.2} fill="currentColor" />}
      </button>

      <div
        className="audio-player__wave"
        role="slider"
        tabIndex={0}
        aria-label={`${label} position`}
        aria-valuemin={0}
        aria-valuemax={Math.round(total)}
        aria-valuenow={Math.round(current)}
        aria-valuetext={`${formatTime(current)} of ${formatTime(total)}`}
        onClick={onBarsClick}
        onKeyDown={onBarsKey}
      >
        {bars.map((b, i) => (
          <span
            key={i}
            className={`audio-player__bar${(i + 0.5) / BARS <= progress ? " audio-player__bar--played" : ""}`}
            style={{ height: `${Math.round(b * 100)}%` }}
          />
        ))}
      </div>

      <span className="audio-player__time">
        {formatTime(current)}
        <span className="audio-player__time-total"> / {formatTime(total)}</span>
      </span>
    </div>
  );
}
