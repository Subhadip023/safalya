import { NextRequest, NextResponse } from "next/server";
import { parseOwnerAndRepo } from "../route";

export async function POST(req: NextRequest) {
  try {
    const role = req.cookies.get("user_role")?.value;
    if (role !== "0") {
      return NextResponse.json(
        { error: "Access denied. Only Super Admins can transfer issues between repositories." },
        { status: 403 }
      );
    }

    const token = process.env.GITHUB_PAT || process.env.GITHUB_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "GITHUB_PAT is not configured in .env.local." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
    }

    const { issueNumber, fromRepo, toRepo } = body as {
      issueNumber?: number;
      fromRepo?: "frontend" | "backend";
      toRepo?: "frontend" | "backend";
    };

    if (!issueNumber || !fromRepo || !toRepo) {
      return NextResponse.json(
        { error: "Missing required parameters: issueNumber, fromRepo, toRepo." },
        { status: 400 }
      );
    }

    if (fromRepo === toRepo) {
      return NextResponse.json(
        { error: "Source and destination repositories cannot be the same." },
        { status: 400 }
      );
    }

    const sourceRaw =
      fromRepo === "frontend"
        ? process.env.GITHUB_FRONTEND_REPO
        : process.env.GITHUB_BACKEND_REPO;

    const destRaw =
      toRepo === "frontend"
        ? process.env.GITHUB_FRONTEND_REPO
        : process.env.GITHUB_BACKEND_REPO;

    const source = parseOwnerAndRepo(sourceRaw);
    const dest = parseOwnerAndRepo(destRaw);

    if (!source || !dest) {
      return NextResponse.json(
        { error: "Both source and destination repositories must be configured in .env.local." },
        { status: 400 }
      );
    }

    // Step 1: Fetch source issue details
    const issueRes = await fetch(
      `https://api.github.com/repos/${source.owner}/${source.repo}/issues/${issueNumber}`,
      {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "Safalya-Issue-Tracker",
        },
      }
    );

    if (!issueRes.ok) {
      return NextResponse.json(
        { error: `Could not fetch issue #${issueNumber} from ${source.owner}/${source.repo}.` },
        { status: 404 }
      );
    }

    const originalIssue = await issueRes.json();

    // Step 2: Try GitHub native issue transfer API
    const transferUrl = `https://api.github.com/repos/${source.owner}/${source.repo}/issues/${issueNumber}/transfer`;
    const transferRes = await fetch(transferUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token.trim()}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "Safalya-Issue-Tracker",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        new_repository: dest.repo,
        new_owner: dest.owner,
      }),
    });

    if (transferRes.ok) {
      const transferredData = await transferRes.json();
      return NextResponse.json({
        success: true,
        method: "native",
        issue: {
          number: transferredData.number,
          title: transferredData.title,
          html_url: transferredData.html_url,
          repository: `${dest.owner}/${dest.repo}`,
        },
      });
    }

    // Step 3: Fallback (create in destination repo + close source with link)
    const labels = (originalIssue.labels || [])
      .map((l: any) => l.name)
      .filter((name: string) => name && name.trim().length > 0);

    const migratedBody = [
      `> 🔄 **Issue transferred from [${source.owner}/${source.repo}#${issueNumber}](${originalIssue.html_url}) by Super Admin**`,
      "",
      originalIssue.body || "_No description provided._",
    ].join("\n");

    const createRes = await fetch(
      `https://api.github.com/repos/${dest.owner}/${dest.repo}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "Safalya-Issue-Tracker",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: originalIssue.title,
          body: migratedBody,
          labels,
        }),
      }
    );

    if (!createRes.ok) {
      const createErr = await createRes.json().catch(() => null);
      return NextResponse.json(
        {
          error: `Failed to create issue in ${dest.owner}/${dest.repo}: ${
            createErr?.message || createRes.statusText
          }`,
        },
        { status: 502 }
      );
    }

    const newIssue = await createRes.json();

    // Close original issue
    await fetch(
      `https://api.github.com/repos/${source.owner}/${source.repo}/issues/${issueNumber}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "Safalya-Issue-Tracker",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          state: "closed",
          state_reason: "not_planned",
        }),
      }
    ).catch(() => null);

    // Comment on original issue
    await fetch(
      `https://api.github.com/repos/${source.owner}/${source.repo}/issues/${issueNumber}/comments`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "Safalya-Issue-Tracker",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: `🔄 **Issue transferred to [${dest.owner}/${dest.repo}#${newIssue.number}](${newIssue.html_url}) by Super Admin.**`,
        }),
      }
    ).catch(() => null);

    return NextResponse.json({
      success: true,
      method: "migrated",
      issue: {
        number: newIssue.number,
        title: newIssue.title,
        html_url: newIssue.html_url,
        repository: `${dest.owner}/${dest.repo}`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to transfer issue.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
