import { NextResponse } from "next/server";
import { getDownloadJob, readJobLogTail } from "@/lib/downloader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/downloads/[id]">,
) {
  const { id } = await context.params;
  const job = getDownloadJob(id);

  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  const logTail = await readJobLogTail(id);

  return NextResponse.json({
    job,
    logTail,
  });
}
