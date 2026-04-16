import { NextResponse } from "next/server";
import {
  createDownloadJob,
  listDownloadJobs,
  type DownloadQuality,
} from "@/lib/downloader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isQuality(value: unknown): value is DownloadQuality {
  return value === "360" || value === "480" || value === "720";
}

export async function GET() {
  return NextResponse.json({
    jobs: listDownloadJobs(),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const quality = body?.quality;
  const shutdownAfterDownload = Boolean(body?.shutdownAfterDownload);

  if (!url) {
    return NextResponse.json(
      { error: "A video or playlist URL is required." },
      { status: 400 },
    );
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json(
      { error: "Please provide a valid URL." },
      { status: 400 },
    );
  }

  if (!isQuality(quality)) {
    return NextResponse.json(
      { error: "Quality must be one of 360, 480, or 720." },
      { status: 400 },
    );
  }

  const job = await createDownloadJob({
    url,
    quality,
    shutdownAfterDownload,
  });

  return NextResponse.json({ job }, { status: 201 });
}
