"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type QualityOption = {
  value: "360" | "480" | "720";
  label: string;
  tagline: string;
  note: string;
};

type DownloadJob = {
  id: string;
  url: string;
  quality: QualityOption["value"];
  shutdownAfterDownload: boolean;
  status: "queued" | "waiting" | "running" | "succeeded" | "failed";
  createdAt: string;
  scheduledFor: string;
  startedAt: string | null;
  finishedAt: string | null;
  outputDirectory: string;
  logFile: string;
  commandPreview: string;
  errorMessage: string | null;
};

const qualityOptions: QualityOption[] = [
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
];

function pad(value: number) {
  return value.toString().padStart(2, "0");
}

function formatClock(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds(),
  )}`;
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
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

function describeJobStatus(job: DownloadJob) {
  if (job.status === "waiting") {
    return `Waiting for Mbembembe hours. Scheduled for ${formatDateTime(job.scheduledFor)}.`;
  }

  if (job.status === "running") {
    return `Running now. Started ${formatDateTime(job.startedAt)}.`;
  }

  if (job.status === "succeeded") {
    return `Finished successfully at ${formatDateTime(job.finishedAt)}.`;
  }

  if (job.status === "failed") {
    return job.errorMessage ?? "The download failed. Check the log tail below.";
  }

  return `Queued at ${formatDateTime(job.createdAt)}.`;
}

function getStatusLabel(status: DownloadJob["status"]) {
  if (status === "waiting") {
    return "Waiting";
  }

  if (status === "running") {
    return "Running";
  }

  if (status === "succeeded") {
    return "Complete";
  }

  if (status === "failed") {
    return "Failed";
  }

  return "Queued";
}

function getStatusTone(status: DownloadJob["status"]) {
  if (status === "succeeded") {
    return "good";
  }

  if (status === "failed") {
    return "bad";
  }

  if (status === "running") {
    return "live";
  }

  return "idle";
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [quality, setQuality] = useState<QualityOption["value"]>("480");
  const [shutdownAfterDownload, setShutdownAfterDownload] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [activeLogTail, setActiveLogTail] = useState("");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitSpinner, setShowSubmitSpinner] = useState(false);
  const [didHydrate, setDidHydrate] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const urlInputRef = useRef<HTMLInputElement | null>(null);

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialUrl = params.get("url");
    const initialQuality = params.get("quality");
    const initialShutdown = params.get("shutdown");
    const initialJob = params.get("job");

    if (initialUrl) {
      setUrl(initialUrl);
    }

    if (
      initialQuality === "360" ||
      initialQuality === "480" ||
      initialQuality === "720"
    ) {
      setQuality(initialQuality);
    }

    if (initialShutdown === "1") {
      setShutdownAfterDownload(true);
    }

    if (initialJob) {
      setActiveJobId(initialJob);
    }

    if (
      window.matchMedia("(min-width: 768px)").matches &&
      document.activeElement === document.body
    ) {
      urlInputRef.current?.focus();
    }

    setDidHydrate(true);
  }, []);

  useEffect(() => {
    if (!didHydrate) {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    if (url.trim()) {
      params.set("url", url.trim());
    } else {
      params.delete("url");
    }

    params.set("quality", quality);

    if (shutdownAfterDownload) {
      params.set("shutdown", "1");
    } else {
      params.delete("shutdown");
    }

    if (activeJobId) {
      params.set("job", activeJobId);
    } else {
      params.delete("job");
    }

    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `/?${nextQuery}` : "/";
    window.history.replaceState(null, "", nextUrl);
  }, [activeJobId, didHydrate, quality, shutdownAfterDownload, url]);

  const refreshJobs = useCallback(async () => {
    const response = await fetch("/api/downloads", { cache: "no-store" });

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { jobs: DownloadJob[] };

    startTransition(() => {
      setJobs(data.jobs);
      setActiveJobId((current) => {
        if (current && data.jobs.some((job) => job.id === current)) {
          return current;
        }

        return data.jobs[0]?.id ?? null;
      });
    });
  }, []);

  const refreshActiveJob = useCallback(async (jobId: string) => {
    const response = await fetch(`/api/downloads/${jobId}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { job: DownloadJob; logTail: string };

    startTransition(() => {
      setJobs((current) =>
        current.map((job) => (job.id === data.job.id ? data.job : job)),
      );
      setActiveLogTail(data.logTail);
    });
  }, []);

  useEffect(() => {
    void refreshJobs();

    const timer = window.setInterval(() => {
      void refreshJobs();
    }, 5_000);

    return () => window.clearInterval(timer);
  }, [refreshJobs]);

  useEffect(() => {
    if (!activeJobId) {
      setActiveLogTail("");
      return;
    }

    void refreshActiveJob(activeJobId);

    const timer = window.setInterval(() => {
      void refreshActiveJob(activeJobId);
    }, 5_000);

    return () => window.clearInterval(timer);
  }, [activeJobId, refreshActiveJob]);

  const selectedQuality =
    qualityOptions.find((option) => option.value === quality) ?? qualityOptions[1];
  const windowState = now ? getWindowState(now) : null;
  const commandPreview = useMemo(
    () =>
      [
        'yt-dlp -f "bestvideo[height<=',
        quality,
        ']+bestaudio/best[height<=',
        quality,
        ']" --yes-playlist --continue --no-part --retries 99 --fragment-retries 99 --write-subs --write-auto-subs --sub-langs "en" --js-runtimes "node" --embed-subs --merge-output-format mkv --no-mtime',
      ].join(""),
    [quality],
  );
  const activeJob = jobs.find((job) => job.id === activeJobId) ?? null;

  useEffect(() => {
    const title = activeJob
      ? `Mbembembe Downloader - ${activeJob.status}`
      : "Mbembembe Downloader";
    document.title = title;
  }, [activeJob]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedUrl = url.trim();
    const spinnerDelayStarted = performance.now();
    const spinnerDelay = window.setTimeout(() => {
      setShowSubmitSpinner(true);
    }, 180);

    setUrl(trimmedUrl);
    setIsSubmitting(true);
    setUrlError(null);
    setSubmitMessage(null);
    setSubmitError(null);

    try {
      if (!trimmedUrl) {
        setUrlError("Paste a video or playlist URL to start a job.");
        setSubmitError("A URL is required before the backend can start.");
        urlInputRef.current?.focus();
        return;
      }

      try {
        new URL(trimmedUrl);
      } catch {
        setUrlError("That does not look like a valid URL yet.");
        setSubmitError("Check the URL and try again.");
        urlInputRef.current?.focus();
        return;
      }

      const response = await fetch("/api/downloads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: trimmedUrl,
          quality,
          shutdownAfterDownload,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        job?: DownloadJob;
      };

      if (!response.ok || !data.job) {
        setSubmitError(data.error ?? "Could not start the download job.");
        return;
      }

      setActiveJobId(data.job.id);
      setSubmitMessage(
        windowState?.inWindow
          ? "Download accepted. The backend will try to start yt-dlp right away."
          : "Download accepted. It will wait for Mbembembe hours before starting.",
      );
      void refreshJobs();
      void refreshActiveJob(data.job.id);
    } catch {
      setSubmitError("The downloader API is not reachable right now.");
    } finally {
      window.clearTimeout(spinnerDelay);

      if (showSubmitSpinner) {
        const elapsed = performance.now() - spinnerDelayStarted;
        if (elapsed < 550) {
          await new Promise((resolve) => window.setTimeout(resolve, 550 - elapsed));
        }
      }

      setShowSubmitSpinner(false);
      setIsSubmitting(false);
    }
  }

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-[92rem] flex-1 scroll-mt-6 flex-col px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
    >
      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <section className="hero-panel rounded-[2rem] p-6 sm:p-8 lg:p-10">
          <div className="hero-noise" aria-hidden="true" />
          <div className="hero-topline">
            <span className="badge">Late-night bandwidth mode</span>
            <span className="badge badge-muted">Next.js 16 App Router</span>
            <span className="badge badge-muted">Local yt-dlp backend</span>
          </div>

          <div className="hero-copy">
            <p className="eyebrow">Mbembembe Downloader</p>
            <h1 className="hero-title">
              Your night-data command center, not another pretty wrapper.
            </h1>
            <p className="hero-subtitle">
              Paste a link, choose the cap, and let the desktop do the heavy
              lifting. Jobs wait for Mbembembe hours, run locally through
              <span translate="no"> yt-dlp </span>
              and feed their logs straight back into the app.
            </p>
          </div>

          <div className="hero-bottom">
            <div className="hero-grid">
              <article className="stat-card stat-card-strong">
                <p className="stat-label">Tonight&apos;s window</p>
                <p className="stat-value">23:00 - 05:59</p>
                <p className="stat-copy">
                  Outside the window, jobs hold position and start automatically
                  when the cheap hours open.
                </p>
              </article>
              <article className="stat-card">
                <p className="stat-label">Engine</p>
                <p className="stat-value">Node + yt-dlp</p>
                <p className="stat-copy">
                  Your browser becomes a control surface, not the download worker.
                </p>
              </article>
              <article className="stat-card">
                <p className="stat-label">Log feedback</p>
                <p className="stat-value">Live tail</p>
                <p className="stat-copy">
                  Every accepted job streams status back into the queue monitor.
                </p>
              </article>
            </div>

            <aside className="hero-callout">
              <p className="mini-label">Current mode</p>
              <div className="hero-callout-row">
                <span className="hero-orb" aria-hidden="true" />
                <div>
                  <p className="hero-callout-value">
                    {windowState?.inWindow ? "Download lane open" : "Waiting for night"}
                  </p>
                  <p className="hero-callout-copy">
                    {windowState?.detail ??
                      "The app checks your local clock before a queued job starts."}
                  </p>
                </div>
              </div>
              <div className="hero-chip-grid">
                <span className="choice-pill">{selectedQuality.label}</span>
                <span className="choice-pill">
                  {shutdownAfterDownload ? "Shutdown armed" : "Shutdown off"}
                </span>
                <span className="choice-pill">
                  {jobs.length === 0
                    ? "No queued jobs"
                    : `${jobs.length} tracked job${jobs.length === 1 ? "" : "s"}`}
                </span>
              </div>
            </aside>
          </div>
        </section>

        <aside className="panel stack-gap rounded-[2rem] p-5 sm:p-6">
          <div>
            <p className="eyebrow">Situation room</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              Live machine state
            </h2>
          </div>

          <div className="status-box status-box-primary">
            <div className="status-head">
              <div>
                <p className="status-label">Local time</p>
                <p className="status-time">{now ? formatClock(now) : "--:--:--"}</p>
              </div>
              <span
                className={
                  windowState?.inWindow ? "status-chip status-chip-live" : "status-chip"
                }
              >
                {windowState?.inWindow ? "Open now" : "Stand by"}
              </span>
            </div>
            <p className={windowState?.inWindow ? "status-good" : "status-wait"}>
              {windowState?.label ?? "Checking Mbembembe window..."}
            </p>
            <p className="status-copy">
              {windowState?.detail ??
                "The app will compare your browser time against the download window."}
            </p>
          </div>

          <div className="status-grid">
            <div className="status-mini-card">
              <p className="status-label">Selection</p>
              <p className="status-mini-value">{selectedQuality.label}</p>
              <p className="status-copy">
                {shutdownAfterDownload
                  ? "Shutdown armed after success."
                  : "Machine stays awake."}
              </p>
            </div>
            <div className="status-mini-card">
              <p className="status-label">Input</p>
              <p className="status-mini-value">{url ? "Loaded" : "Empty"}</p>
              <p className="status-copy">
                {url
                  ? "The current URL is synced into the address bar."
                  : "Paste a link to prime the next run."}
              </p>
            </div>
          </div>

          <div className="latest-job-card">
            <div className="latest-job-head">
              <div>
                <p className="status-label">Latest job</p>
                <p className="latest-job-title">
                  {activeJob
                    ? `${activeJob.quality}p ${getStatusLabel(activeJob.status)}`
                    : "No active job yet"}
                </p>
              </div>
              <span
                className={`status-chip status-chip-${activeJob ? getStatusTone(activeJob.status) : "idle"}`}
              >
                {activeJob ? getStatusLabel(activeJob.status) : "Idle"}
              </span>
            </div>
            <p className="status-copy">
              {activeJob
                ? describeJobStatus(activeJob)
                : "Start a job and the current queue leader will appear here with richer context."}
            </p>
          </div>
        </aside>
      </section>

      <section className="mt-5 grid gap-5 xl:grid-cols-[0.72fr_1.28fr]">
        <section className="panel rounded-[2rem] p-5 sm:p-6 lg:p-7">
          <div className="composer-head">
            <div>
              <p className="eyebrow">Build the job</p>
              <h2 className="mt-2 text-3xl font-semibold text-white">
                Download recipe
              </h2>
            </div>
            <p className="composer-copy">
              Pick the ceiling, arm the shutdown if you want it, then hand the run
              off to the queue.
            </p>
          </div>

          <form className="stack-gap mt-7" onSubmit={handleSubmit}>
            <label className="field field-featured">
              <span className="field-label" id="url-label">
                Video or playlist URL
              </span>
              <input
                ref={urlInputRef}
                className="field-input"
                type="url"
                inputMode="url"
                autoComplete="off"
                spellCheck={false}
                name="source_url"
                placeholder="https://youtube.com/playlist?list=..."
                value={url}
                aria-describedby={urlError ? "url-error url-help" : "url-help"}
                aria-invalid={urlError ? "true" : "false"}
                onChange={(event) => {
                  setUrl(event.target.value);
                  if (urlError) {
                    setUrlError(null);
                  }
                }}
              />
              <span className="field-help" id="url-help">
                Paste a single video or a playlist. The value stays in the URL so
                refresh and share still work.
              </span>
              {urlError ? (
                <span className="field-error" id="url-error" role="alert">
                  {urlError}
                </span>
              ) : null}
            </label>

            <fieldset className="grid gap-3">
              <legend className="field-label">Quality cap</legend>
              <div className="quality-grid mt-1">
                {qualityOptions.map((option) => (
                  <label
                    key={option.value}
                    className={quality === option.value ? "quality-card active" : "quality-card"}
                  >
                    <input
                      checked={quality === option.value}
                      className="sr-only-input"
                      name="quality"
                      type="radio"
                      value={option.value}
                      onChange={() => setQuality(option.value)}
                    />
                    <span className="quality-heading">
                      <strong>{option.label}</strong>
                      <em>{option.tagline}</em>
                    </span>
                    <span className="quality-note">{option.note}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="toggle-row">
              <div>
                <span className="field-label">Power action</span>
                <p className="field-help">
                  If this is on and the job succeeds, Windows gets a shutdown
                  request with a 60 second countdown.
                </p>
              </div>
              <input
                checked={shutdownAfterDownload}
                className="sr-only-input"
                name="shutdown_after_download"
                type="checkbox"
                onChange={(event) => setShutdownAfterDownload(event.target.checked)}
              />
              <span className="toggle-meta">
                <span className="toggle-copy">
                  {shutdownAfterDownload ? "Shutdown armed" : "Keep machine awake"}
                </span>
                <span
                  aria-hidden="true"
                  className={shutdownAfterDownload ? "toggle active" : "toggle"}
                >
                  <span className="toggle-thumb" />
                </span>
              </span>
            </label>

            <div className="stack-gap" aria-live="polite" aria-atomic="true">
              <button className="launch-button" type="submit" disabled={isSubmitting}>
                <span className="launch-label">
                  {isSubmitting ? "Starting Mbembembe Job…" : "Start Mbembembe Job"}
                </span>
                {showSubmitSpinner ? (
                  <span aria-hidden="true" className="loading-dot" />
                ) : null}
                <span className="sr-only-status">
                  {isSubmitting ? " Sending to backend…" : ""}
                </span>
              </button>
              {submitMessage ? <p className="status-good">{submitMessage}</p> : null}
              {submitError ? <p className="status-wait">{submitError}</p> : null}
            </div>
          </form>
        </section>

        <div className="monitor-grid">
          <section className="panel rounded-[2rem] p-5 sm:p-6 lg:p-7">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Runtime</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">
                  What the backend runs
                </h2>
              </div>
              <span className="choice-pill command-tag">Local process</span>
            </div>

            <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--text-soft)]">
              The API route starts <span translate="no">yt-dlp</span> on the same
              machine running Next.js. Downloads land inside the project folder,
              and every job gets its own log trail.
            </p>

            <pre className="command-box command-box-hero">
              <code>{commandPreview}</code>
            </pre>

            <div className="info-grid mt-5">
              <div className="mini-card info-card">
                <p className="mini-label">Output folder</p>
                <p className="mini-copy">
                  {activeJob?.outputDirectory ?? "Will be created as ./downloads"}
                </p>
              </div>
              <div className="mini-card info-card">
                <p className="mini-label">Log file</p>
                <p className="mini-copy">
                  {activeJob?.logFile ?? "Will be created as ./download_logs/<job>.log"}
                </p>
              </div>
            </div>
          </section>

          <section className="panel rounded-[2rem] p-5 sm:p-6 lg:p-7">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Queue monitor</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">
                  Jobs and live output
                </h2>
              </div>
              <span className="choice-pill">{jobs.length} tracked</span>
            </div>

            <div className="queue-layout mt-6">
              <div className="job-list">
                {jobs.length === 0 ? (
                  <div className="empty-state">
                    <p className="empty-title">No jobs yet</p>
                    <p className="mini-copy">
                      Start one from the composer and this space turns into your
                      run history.
                    </p>
                  </div>
                ) : null}

                {jobs.map((job) => (
                  <button
                    key={job.id}
                    type="button"
                    className={activeJobId === job.id ? "job-card active" : "job-card"}
                    aria-pressed={activeJobId === job.id}
                    onClick={() => setActiveJobId(job.id)}
                  >
                    <div className="job-card-top">
                      <div>
                        <p className="job-title">{job.quality}p job</p>
                        <p className="job-copy">{job.url}</p>
                      </div>
                      <span
                        className={`status-chip status-chip-${getStatusTone(job.status)}`}
                      >
                        {getStatusLabel(job.status)}
                      </span>
                    </div>
                    <p className="job-copy">{describeJobStatus(job)}</p>
                  </button>
                ))}
              </div>

              <div className="log-panel">
                <div className="log-panel-head">
                  <div>
                    <p className="mini-label">Latest log lines</p>
                    <p className="log-panel-title">
                      {activeJob
                        ? `${activeJob.quality}p ${getStatusLabel(activeJob.status)}`
                        : "Waiting for a selected job"}
                    </p>
                  </div>
                  {activeJob ? (
                    <span
                      className={`status-chip status-chip-${getStatusTone(activeJob.status)}`}
                    >
                      {getStatusLabel(activeJob.status)}
                    </span>
                  ) : null}
                </div>

                <pre
                  className="command-box log-box"
                  aria-live="polite"
                  aria-label="Latest job log output"
                >
                  <code>
                    {activeLogTail ||
                      "Choose a job to inspect its log. Output from yt-dlp will appear here."}
                  </code>
                </pre>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

