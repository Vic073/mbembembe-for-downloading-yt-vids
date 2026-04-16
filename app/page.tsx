"use client";

import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
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

  const refreshJobs = useCallback(async () => {
    const response = await fetch("/api/downloads", { cache: "no-store" });

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { jobs: DownloadJob[] };

    startTransition(() => {
      setJobs(data.jobs);
      setActiveJobId((current) => current ?? data.jobs[0]?.id ?? null);
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setSubmitMessage(null);
    setSubmitError(null);

    try {
      const response = await fetch("/api/downloads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
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
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-5 py-8 sm:px-8 lg:px-10">
      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="hero-panel overflow-hidden rounded-[2rem] p-7 sm:p-10">
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <span className="badge">Late-night bandwidth mode</span>
            <span className="badge badge-muted">Next.js 16 App Router</span>
            <span className="badge badge-muted">Local yt-dlp backend</span>
          </div>

          <div className="max-w-3xl space-y-6">
            <p className="text-sm uppercase tracking-[0.35em] text-[var(--text-soft)]">
              Mbembembe Downloader
            </p>
            <h1 className="max-w-2xl text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">
              Queue real downloads from the browser and let the machine handle the night shift.
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-[var(--text-soft)]">
              The web app now talks to a local Node route that writes logs,
              waits for your off-peak window, runs `yt-dlp`, and can request a
              Windows shutdown when the job succeeds.
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <article className="stat-card">
              <p className="stat-label">Window</p>
              <p className="stat-value">23:00 - 05:59</p>
              <p className="stat-copy">Jobs outside the window stay queued.</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Backend</p>
              <p className="stat-value">Route Handler</p>
              <p className="stat-copy">Node runtime launches `yt-dlp` locally.</p>
            </article>
            <article className="stat-card">
              <p className="stat-label">Logs</p>
              <p className="stat-value">Live tail</p>
              <p className="stat-copy">Recent output is visible from the app.</p>
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

          <div className="rounded-[1.5rem] border border-white/10 bg-white/4 p-5">
            <p className="status-label">Latest job</p>
            <p className="mt-3 text-lg font-semibold text-white">
              {activeJob ? activeJob.status.toUpperCase() : "No jobs yet"}
            </p>
            <p className="status-copy">
              {activeJob
                ? describeJobStatus(activeJob)
                : "Start a job and the backend status will appear here."}
            </p>
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

          <form className="stack-gap" onSubmit={handleSubmit}>
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
                  If this is on and the job succeeds, Windows gets a shutdown
                  request with a 60 second countdown.
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

            <div className="stack-gap">
              <button
                className="launch-button"
                type="submit"
                disabled={isSubmitting || !url.trim()}
              >
                {isSubmitting ? "Sending to backend..." : "Start Mbembembe Job"}
              </button>
              {submitMessage ? <p className="status-good">{submitMessage}</p> : null}
              {submitError ? <p className="status-wait">{submitError}</p> : null}
            </div>
          </form>
        </div>

        <div className="stack-gap">
          <div className="panel rounded-[2rem] p-6 sm:p-8">
            <p className="eyebrow">Command preview</p>
            <h2 className="mt-2 text-3xl font-semibold text-white">
              What the backend runs
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--text-soft)]">
              The API route starts `yt-dlp` on the same machine running Next.js.
              Downloads are written under the project folder, and every job gets
              its own log file.
            </p>

            <pre className="command-box">
              <code>{commandPreview}</code>
            </pre>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="mini-card">
                <p className="mini-label">Output folder</p>
                <p className="mini-copy">
                  {activeJob?.outputDirectory ?? "Will be created as ./downloads"}
                </p>
              </div>
              <div className="mini-card">
                <p className="mini-label">Log file</p>
                <p className="mini-copy">
                  {activeJob?.logFile ?? "Will be created as ./download_logs/<job>.log"}
                </p>
              </div>
            </div>
          </div>

          <div className="panel rounded-[2rem] p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Recent jobs</p>
                <h2 className="mt-2 text-3xl font-semibold text-white">
                  Queue and log tail
                </h2>
              </div>
              <span className="choice-pill">{jobs.length} tracked</span>
            </div>

            <div className="mt-5 grid gap-3">
              {jobs.length === 0 ? (
                <div className="mini-card">
                  <p className="mini-copy">
                    No jobs yet. Start one from the form and it will show up here.
                  </p>
                </div>
              ) : null}

              {jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  className={activeJobId === job.id ? "job-card active" : "job-card"}
                  onClick={() => setActiveJobId(job.id)}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="job-title">{job.quality}p job</p>
                      <p className="job-copy">{job.url}</p>
                    </div>
                    <span className="choice-pill">{job.status}</span>
                  </div>
                  <p className="job-copy">{describeJobStatus(job)}</p>
                </button>
              ))}
            </div>

            <div className="mt-5">
              <p className="mini-label">Latest log lines</p>
              <pre className="command-box mt-3 min-h-56">
                <code>
                  {activeLogTail ||
                    "Choose a job to inspect its log. Output from yt-dlp will appear here."}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
