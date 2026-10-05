import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

function parseOwnerAndRepo(repoUrlOrSlug?: string | null): { owner: string; repo: string } | null {
  if (!repoUrlOrSlug) return null;
  const cleaned = repoUrlOrSlug
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "");

  const parts = cleaned.split("/");
  if (parts.length >= 2 && parts[0] && parts[1]) {
    return { owner: parts[0], repo: parts[1] };
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const token = (process.env.GITHUB_PAT || process.env.GITHUB_TOKEN)?.trim();
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const repoType = (formData.get("repository") as string) || "frontend";

    if (!file) {
      return NextResponse.json({ error: "No image file provided." }, { status: 400 });
    }

    // Validate mime type
    const validMimes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];
    if (!validMimes.includes(file.type.toLowerCase()) && !file.name.match(/\.(png|jpe?g|gif|webp|svg)$/i)) {
      return NextResponse.json(
        { error: "Invalid file type. Only image files (PNG, JPG, GIF, WebP, SVG) are allowed." },
        { status: 400 }
      );
    }

    // Limit size to 10MB
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Image file exceeds maximum allowed size of 10MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Content = buffer.toString("base64");

    const rawExt = path.extname(file.name) || ".png";
    const ext = rawExt.startsWith(".") ? rawExt : `.${rawExt}`;
    const cleanBasename = path
      .basename(file.name, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .substring(0, 30);
    const uniqueName = `issue_${Date.now()}_${cleanBasename || "img"}${ext}`;
    const targetGithubPath = `.github/issue-attachments/${uniqueName}`;

    // Target repository
    const targetRepoConfig =
      repoType === "backend" ? process.env.GITHUB_BACKEND_REPO : process.env.GITHUB_FRONTEND_REPO;
    const parsedRepo = parseOwnerAndRepo(targetRepoConfig);

    // Attempt 1: Upload to GitHub repository via GitHub Contents API
    if (token && parsedRepo) {
      try {
        const ghUrl = `https://api.github.com/repos/${parsedRepo.owner}/${parsedRepo.repo}/contents/${targetGithubPath}`;
        const ghRes = await fetch(ghUrl, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            "User-Agent": "Safalya-Issue-Tracker",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: `Upload issue image attachment [skip ci]`,
            content: base64Content,
          }),
        });

        if (ghRes.ok) {
          const ghData = await ghRes.json();
          const downloadUrl =
            ghData?.content?.download_url ||
            `https://raw.githubusercontent.com/${parsedRepo.owner}/${parsedRepo.repo}/main/${targetGithubPath}`;

          return NextResponse.json({
            success: true,
            url: downloadUrl,
            filename: uniqueName,
            storage: "github",
          });
        }
      } catch {
        // Fallback to local upload
      }
    }

    // Fallback: Save to local public/uploads/issues folder
    try {
      const publicDir = path.join(process.cwd(), "public", "uploads", "issues");
      await fs.mkdir(publicDir, { recursive: true });
      const localFilePath = path.join(publicDir, uniqueName);
      await fs.writeFile(localFilePath, buffer);

      return NextResponse.json({
        success: true,
        url: `/uploads/issues/${uniqueName}`,
        filename: uniqueName,
        storage: "local",
      });
    } catch (localErr) {
      console.error("Local file save error:", localErr);
      return NextResponse.json(
        { error: "Failed to upload image file to GitHub or local storage." },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal upload error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
