"use client";

import { useEffect, useState } from "react";

const qualityOptions = [
  {
    value: "360",
    label: "360p",
    tagline: "Ultra Save Data",
    note: "Smallest files for tight bundles and backup nights.",
  },
  {
    value: "480",
    label: "480p",
    tagline: "Recommended",
    note: "The same balanced default your batch file falls back to.",
  },
  {
    value: "720",
    label: "720p",
    tagline: "Higher Quality",
    note: "Sharper video while still respecting the selected cap.",
  },
] as const;

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function formatClock(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds(),
  )}`;
}

function getWindowState(now: Date) {
  const hour = now.getHours();
  const inWindow = hour >= 23 || hour <= 5;

  if (inWindow) {
    return {
      inWindow,
      label: "Mbembembe hours are active right now.",
      detail: "Downloads can start immediately between 23:00 and 05:59.",
    };
  }

  const nextWindow = new Date(now);
  nextWindow.setHours(23, 0, 0, 0);

  return {
    inWindow,
    label: "Outside Mbembembe hours.",
    detail: `Next download window opens today at ${formatClock(nextWindow)}.`,
  };
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [quality, setQuality] = useState<(typeof qualityOptions)[number]["value"]>(
    "480",
  );
  const [shutdownAfterDownload, setShutdownAfterDownload] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => {
      setNow(new Date());
    }, 0);

    const timer = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(timer);
    };
  }, []);

  const selectedQuality =
    qualityOptions.find((option) => option.value === quality) ?? qualityOptions[1];
  const windowState = now ? getWindowState(now) : null;
  const commandPreview = [
    'yt-dlp -f "bestvideo[height<=',
    quality,
    ']+bestaudio/best[height<=',
    quality,
    ']" --yes-playlist --continue --no-part --retries 99 --fragment-retries 99 --write-subs --write-auto-subs --sub-langs "en.*" --embed-subs --merge-output-format mkv --no-mtime',
  ].join("");

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 py-8 sm:px-8 lg:px-10">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="hero-panel overflow-hidden rounded-[2rem] p-7 sm:p-10">
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <span className="badge">Late-night bandwidth mode</span>
            <span className="badge badge-muted">Next.js 16 App Router</span>
          </div>

          <div className="max-w-3xl space-y-6">
            <p className="text-sm uppercase tracking-[0.35em] text-[var(--text-soft)]">
              Mbembembe Downloader
            </p>
            <h1 className="max-w-2xl text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">
              Turn your batch-file ritual into a proper download control room.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[var(--text-soft)]">
              Same idea, cleaner interface: paste a playlist or video URL, choose
              a quality cap, queue it for Mbembembe hours, and decide whether the
              machine should sleep afterward.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <article className="stat-card">
              <p className="stat-label">Window</p>
              <p className="stat-value">23:00 - 05:59</p>
              <p className="stat-copy">Matches the original overnight rule.</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Output</p>
              <p className="stat-value">MKV + Subtitles</p>
              <p className="stat-copy">Embeds English subs when available.</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Retries</p>
              <p className="stat-value">99 / 99</p>
              <p className="stat-copy">Stays stubborn on weak connections.</p>
            </article>
          </div>
        </div>

        <div className="panel stack-gap rounded-[2rem] p-6 sm:p-8">
          <div>
            <p className="eyebrow">Live session</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Tonight&apos;s downloader state
            </h2>
          </div>

          <div className="status-box">
            <p className="status-label">Local time</p>
            <p className="status-time">{now ? formatClock(now) : "--:--:--"}</p>
            <p className={windowState?.inWindow ? "status-good" : "status-wait"}>
              {windowState?.label ?? "Checking Mbembembe window..."}
            </p>
            <p className="status-copy">
              {windowState?.detail ??
                "The app will compare your browser time against the download window."}
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-white/10 bg-white/4 p-5">
            <p className="status-label">Current selection</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <span className="choice-pill">{selectedQuality.label}</span>
              <span className="choice-pill">
                {shutdownAfterDownload ? "Shutdown after download" : "Stay awake"}
              </span>
              <span className="choice-pill">
                {url ? "URL loaded" : "Waiting for URL"}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="panel rounded-[2rem] p-6 sm:p-8">
          <div className="mb-6">
            <p className="eyebrow">Build the job</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              Download recipe
            </h2>
          </div>

          <form className="stack-gap">
            <label className="field">
              <span className="field-label">Video or playlist URL</span>
              <input
                className="field-input"
                type="url"
                placeholder="https://youtube.com/playlist?list=..."
                value={url}
                onChange={(event) => setUrl(event.target.value)}
              />
            </label>

            <div>
              <span className="field-label">Quality cap</span>
              <div className="mt-3 grid gap-3">
                {qualityOptions.map((option) => (
                  <button
                    key={option.value}
                    className={quality === option.value ? "quality-card active" : "quality-card"}
                    type="button"
                    onClick={() => setQuality(option.value)}
                  >
                    <span>
                      <strong>{option.label}</strong> {option.tagline}
                    </span>
                    <span className="quality-note">{option.note}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="toggle-row">
              <div>
                <span className="field-label">Power action</span>
                <p className="field-help">
                  Keep the original optional shutdown behavior after the queue
                  finishes.
                </p>
              </div>
              <button
                className={shutdownAfterDownload ? "toggle active" : "toggle"}
                type="button"
                aria-pressed={shutdownAfterDownload}
                onClick={() => setShutdownAfterDownload((value) => !value)}
              >
                <span className="toggle-thumb" />
              </button>
            </label>
          </form>
        </div>

        <div className="stack-gap">
          <div className="panel rounded-[2rem] p-6 sm:p-8">
            <p className="eyebrow">Command preview</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              What the app should run
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--text-soft)]">
              This preserves the spirit of your batch script. The missing piece
              later is wiring this UI to a server action or API route that can
              safely launch `yt-dlp` on your machine.
            </p>

            <pre className="command-box">
              <code>{commandPreview}</code>
            </pre>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="mini-card">
                <p className="mini-label">Output template</p>
                <p className="mini-copy">
                  `%(playlist_title,Unknown)s/%(playlist_index,1)s - %(title)s.%(ext)s`
                </p>
              </div>
              <div className="mini-card">
                <p className="mini-label">Shutdown</p>
                <p className="mini-copy">
                  {shutdownAfterDownload
                    ? "Enabled: request system shutdown after completion."
                    : "Disabled: machine stays on when downloads finish."}
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <article className="panel feature-card p-5">
              <p className="mini-label">Queue logic</p>
              <p className="feature-copy">
                Waits until your off-peak time instead of starting immediately.
              </p>
            </article>
            <article className="panel feature-card p-5">
              <p className="mini-label">Subtitle defaults</p>
              <p className="feature-copy">
                Pulls English subtitles and auto-subs, then embeds them.
              </p>
            </article>
            <article className="panel feature-card p-5">
              <p className="mini-label">Resilience</p>
              <p className="feature-copy">
                Continues interrupted downloads and retries aggressively.
              </p>
            </article>
          </div>
        </div>
      </section>
    </main>
  );
}
