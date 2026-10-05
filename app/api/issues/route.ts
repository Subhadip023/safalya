import { NextRequest, NextResponse } from "next/server";

export function parseOwnerAndRepo(input: string | undefined): { owner: string; repo: string } | null {
  if (!input) return null;
  let clean = input.trim();
  if (clean.endsWith(".git")) clean = clean.slice(0, -4);
  clean = clean.replace(/^https?:\/\/github\.com\//, "");
  clean = clean.replace(/^git@github\.com:/, "");
  const parts = clean.split("/").filter(Boolean);
  if (parts.length >= 2) {
    return { owner: parts[0], repo: parts[1] };
  }
  return null;
}

async function fetchRepoIssues(
  owner: string,
  repo: string,
  token: string,
  targetType: "frontend" | "backend",
  state: string = "all"
) {
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=${state}&per_page=100`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Safalya-App",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error(`Failed to fetch issues from ${owner}/${repo}:`, res.status);
      return [];
    }

    const data = await res.json().catch(() => []);
    if (!Array.isArray(data)) return [];

    // Filter out pull requests
    return data
      .filter((item: any) => !item.pull_request)
      .map((item: any) => ({
        id: item.id,
        number: item.number,
        title: item.title,
        body: item.body || "",
        state: item.state,
        html_url: item.html_url,
        created_at: item.created_at,
        updated_at: item.updated_at,
        closed_at: item.closed_at,
        comments_count: item.comments || 0,
        user: {
          login: item.user?.login || "unknown",
          avatar_url: item.user?.avatar_url || "",
        },
        labels: (item.labels || []).map((l: any) => ({
          id: l.id,
          name: l.name,
          color: l.color,
          description: l.description,
        })),
        repositoryType: targetType,
        repositoryName: `${owner}/${repo}`,
      }));
  } catch (err) {
    console.error(`Error fetching issues for ${owner}/${repo}:`, err);
    return [];
  }
}

export async function GET(req: NextRequest) {
  const token = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
  const frontendRaw = process.env.GITHUB_FRONTEND_REPO;
  const backendRaw = process.env.GITHUB_BACKEND_REPO;

  const frontendParsed = parseOwnerAndRepo(frontendRaw);
  const backendParsed = parseOwnerAndRepo(backendRaw);

  const searchParams = req.nextUrl.searchParams;
  const shouldList = searchParams.get("list") === "true";

  if (!shouldList) {
    return NextResponse.json({
      hasToken: Boolean(token),
      repositories: {
        frontend: frontendParsed ? `${frontendParsed.owner}/${frontendParsed.repo}` : null,
        backend: backendParsed ? `${backendParsed.owner}/${backendParsed.repo}` : null,
      },
      configured: Boolean(token && (frontendParsed || backendParsed)),
    });
  }

  // Super Admin listing of issues
  if (!token) {
    return NextResponse.json(
      { error: "GITHUB_PAT is not configured in .env.local." },
      { status: 400 }
    );
  }

  const requestedRepo = searchParams.get("repo") || "all"; // 'all' | 'frontend' | 'backend'
  const requestedState = searchParams.get("state") || "all"; // 'all' | 'open' | 'closed'

  const promises: Promise<any[]>[] = [];

  if ((requestedRepo === "all" || requestedRepo === "frontend") && frontendParsed) {
    promises.push(
      fetchRepoIssues(
        frontendParsed.owner,
        frontendParsed.repo,
        token,
        "frontend",
        requestedState
      )
    );
  }

  if ((requestedRepo === "all" || requestedRepo === "backend") && backendParsed) {
    promises.push(
      fetchRepoIssues(
        backendParsed.owner,
        backendParsed.repo,
        token,
        "backend",
        requestedState
      )
    );
  }

  const results = await Promise.all(promises);
  const allIssues = results.flat();

  // Sort descending by created_at
  allIssues.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return NextResponse.json({
    issues: allIssues,
    count: allIssues.length,
    repositories: {
      frontend: frontendParsed ? `${frontendParsed.owner}/${frontendParsed.repo}` : null,
      backend: backendParsed ? `${backendParsed.owner}/${backendParsed.repo}` : null,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const token = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json(
        {
          error:
            "GitHub Personal Access Token (GITHUB_PAT) is not configured in .env.local. Please add GITHUB_PAT to enable GitHub issue creation.",
        },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const {
      repository = "frontend",
      title,
      description,
      issueType = "bug",
      diagnostics = {},
    } = body as {
      repository?: string;
      title?: string;
      description?: string;
      issueType?: string;
      diagnostics?: {
        pageUrl?: string;
        role?: string;
        userName?: string;
        organizationName?: string;
        userAgent?: string;
        screen?: string;
      };
    };

    // Rule: All regular users (non-super-admin) unconditionally submit to the frontend repo.
    // Only super admin (role === "0") can select another repository.
    const cookieRole = req.cookies.get("user_role")?.value;
    const isSuperAdmin = cookieRole === "0";
    const effectiveRepoType: "frontend" | "backend" =
      isSuperAdmin && repository === "backend" ? "backend" : "frontend";

    if (!title || !title.trim()) {
      return NextResponse.json({ error: "Issue title is required." }, { status: 400 });
    }

    const rawDesc = typeof description === "string" ? description : "";
    // Check if description is empty (accounting for Quill HTML tags like <p><br></p>)
    const textOnly = rawDesc.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    const hasImages = /<img\s+[^>]*src=/i.test(rawDesc);
    if (!textOnly && !hasImages) {
      return NextResponse.json({ error: "Issue description is required." }, { status: 400 });
    }

    const targetRepoConfig =
      effectiveRepoType === "frontend"
        ? process.env.GITHUB_FRONTEND_REPO
        : process.env.GITHUB_BACKEND_REPO;

    const parsedRepo = parseOwnerAndRepo(targetRepoConfig);
    if (!parsedRepo) {
      const envKey = effectiveRepoType === "frontend" ? "GITHUB_FRONTEND_REPO" : "GITHUB_BACKEND_REPO";
      return NextResponse.json(
        {
          error: `The ${effectiveRepoType} repository is not configured in .env.local. Please set ${envKey}="owner/repo".`,
        },
        { status: 400 }
      );
    }

    // Prepare labels
    const labelMap: Record<string, string[]> = {
      bug: ["bug", "in-app-report"],
      enhancement: ["enhancement", "in-app-report"],
      question: ["question", "in-app-report"],
      task: ["task", "in-app-report"],
    };
    const labels = labelMap[issueType] ?? ["in-app-report"];

    // Process description: If any inline base64 images exist, upload them to GitHub attachments
    let processedDescription = rawDesc.trim();
    if (token && parsedRepo && processedDescription.includes("data:image/")) {
      const dataUriRegex = /src=["'](data:image\/([a-zA-Z0-9+]+);base64,([^"']+))["']/g;
      const matches: { full: string; ext: string; b64: string }[] = [];
      let m: RegExpExecArray | null;
      while ((m = dataUriRegex.exec(processedDescription)) !== null) {
        matches.push({ full: m[1], ext: m[2].toLowerCase().replace("jpeg", "jpg"), b64: m[3] });
      }

      for (const item of matches) {
        const uniqueName = `issue_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${item.ext}`;
        const targetGithubPath = `.github/issue-attachments/${uniqueName}`;
        try {
          const ghUrl = `https://api.github.com/repos/${parsedRepo.owner}/${parsedRepo.repo}/contents/${targetGithubPath}`;
          const ghRes = await fetch(ghUrl, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token.trim()}`,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
              "User-Agent": "Safalya-Issue-Tracker",
              "Content-Type": "application/json",
            }, 
            body: JSON.stringify({
              message: "Upload issue image attachment [skip ci]",
              content: item.b64,
            }),
          });
          if (ghRes.ok) {
            const rawUrl = `https://raw.githubusercontent.com/${parsedRepo.owner}/${parsedRepo.repo}/main/${targetGithubPath}`;
            processedDescription = processedDescription.replace(item.full, rawUrl);
          }
        } catch {
          // ignore
        }
      }
    }

    // Convert HTML description into clean GitHub Flavored Markdown (with native image markdown)
    let formattedDescription = processedDescription;
    // Convert <img> tags to Markdown images
    formattedDescription = formattedDescription.replace(
      /<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi,
      "\n\n![]($1)\n\n"
    );
    // Convert basic formatting tags
    formattedDescription = formattedDescription
      .replace(/<(b|strong)>(.*?)<\/\1>/gi, "**$2**")
      .replace(/<(i|em)>(.*?)<\/\1>/gi, "*$2*")
      .replace(/<code>(.*?)<\/code>/gi, "`$1`")
      .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "\n```\n$1\n```\n")
      .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gi, "[$2]($1)")
      .replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n")
      .replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    // Format rich Markdown body
    const markdownBody = [
      `### Description`,
      formattedDescription || processedDescription,
      "",
      "---",
      "### 📋 System & Diagnostic Details",
      `- **Target System**: ${effectiveRepoType === "frontend" ? "Frontend (Web Client)" : "Backend (FastAPI Server)"}`,
      diagnostics.userName ? `- **Reported By**: ${diagnostics.userName}` : null,
      diagnostics.role ? `- **User Role**: ${diagnostics.role}` : null,
      diagnostics.organizationName ? `- **Organization**: ${diagnostics.organizationName}` : null,
      diagnostics.pageUrl ? `- **Page URL**: \`${diagnostics.pageUrl}\`` : null,
      diagnostics.screen ? `- **Screen Resolution**: ${diagnostics.screen}` : null,
      diagnostics.userAgent ? `- **Browser**: \`${diagnostics.userAgent}\`` : null,
      `- **Created At**: ${new Date().toUTCString()}`,
    ]
      .filter((line) => line !== null)
      .join("\n");

    const ghUrl = `https://api.github.com/repos/${parsedRepo.owner}/${parsedRepo.repo}/issues`;

    const ghRes = await fetch(ghUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Safalya-Issue-Tracker",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: title.trim(),
        body: markdownBody,
        labels,
      }),
    });

    const ghData = await ghRes.json().catch(() => null);

    if (!ghRes.ok) {
      const errorMsg =
        ghData && typeof ghData === "object" && "message" in ghData && typeof ghData.message === "string"
          ? ghData.message
          : `GitHub API error (status ${ghRes.status})`;

      let hint = "";
      if (ghRes.status === 401) {
        hint = " Check that your GITHUB_PAT is valid and has not expired.";
      } else if (ghRes.status === 404) {
        hint = ` Verify that repository '${parsedRepo.owner}/${parsedRepo.repo}' exists and your token has permission to access it.`;
      }

      return NextResponse.json(
        { error: `${errorMsg}.${hint}` },
        { status: ghRes.status >= 500 ? 502 : 400 }
      );
    }

    return NextResponse.json({
      success: true,
      issue: {
        id: ghData.id,
        number: ghData.number,
        title: ghData.title,
        html_url: ghData.html_url,
        state: ghData.state,
        repository: `${parsedRepo.owner}/${parsedRepo.repo}`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create GitHub issue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
