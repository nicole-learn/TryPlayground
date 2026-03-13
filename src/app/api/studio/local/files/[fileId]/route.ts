import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { getLocalFile } from "@/server/local/local-store";

export const runtime = "nodejs";

interface LocalFileRouteContext {
  params: Promise<{
    fileId: string;
  }>;
}

export async function GET(
  _request: Request,
  context: LocalFileRouteContext
) {
  const { fileId } = await context.params;
  const file = getLocalFile(fileId);

  if (!file) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const body = await fs.readFile(file.absolutePath);
    return new NextResponse(body, {
      headers: {
        "Content-Type": file.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${file.fileName || fileId}"`,
        "Cache-Control": "private, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
