import { useEffect, useRef } from "react";

const BARS = 56;

// Scrolling voice-memo style waveform, driven by a real Web Audio
// AnalyserNode on the microphone stream (nothing is sent anywhere — the
// recording itself is still produced by MediaRecorder in Submit.jsx).
// Each sampled level is also pushed into `peaksRef` so the finished
// recording can render a static waveform in the player without a second
// pass over the audio. With no analyser (unsupported browser) it draws a
// calm idle line instead of faking activity.
export default function LiveWaveform({ analyser, peaksRef }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const styles = getComputedStyle(canvas);
    const color = styles.getPropertyValue("--wave-color").trim() || "#d99863";
    const idleColor = styles.getPropertyValue("--wave-idle").trim() || "rgba(240,233,218,0.25)";

    function resize() {
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
    }
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas);

    const history = new Array(BARS).fill(0);
    const data = analyser ? new Uint8Array(analyser.fftSize) : null;
    let raf;
    let last = 0;

    function draw(now) {
      raf = requestAnimationFrame(draw);
      if (now - last < 48) return;
      last = now;

      let level = 0;
      if (analyser && data) {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const n = (data[i] - 128) / 128;
          sum += n * n;
        }
        level = Math.min(1, Math.sqrt(sum / data.length) * 3.4);
        peaksRef?.current?.push(level);
      }
      history.push(level);
      history.shift();

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      const gap = 3 * dpr;
      const barW = (w - gap * (BARS - 1)) / BARS;
      const minH = 3 * dpr;

      history.forEach((lv, i) => {
        const barH = Math.max(minH, lv * h * 0.94);
        const x = i * (barW + gap);
        const y = (h - barH) / 2;
        const age = i / (BARS - 1); // 0 = oldest (left), 1 = newest (right)
        ctx.globalAlpha = lv > 0.02 ? 0.25 + age * 0.75 : 1;
        ctx.fillStyle = lv > 0.02 ? color : idleColor;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, barW, barH, barW / 2);
        else ctx.rect(x, y, barW, barH);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
    };
  }, [analyser, peaksRef]);

  return <canvas ref={canvasRef} className="live-waveform" aria-hidden="true" />;
}
