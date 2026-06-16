from __future__ import annotations

import json
import os
import urllib.error
import urllib.request


API_ROOT = "https://api.github.com"
ISSUE_TITLE = "Neue Wohnungsangebote"


class GitHubIssueError(RuntimeError):
    pass


def post_report_to_issue(markdown: str, title: str = ISSUE_TITLE) -> str | None:
    token = os.environ.get("GITHUB_TOKEN")
    repository = os.environ.get("GITHUB_REPOSITORY")
    if not token or not repository:
        return None

    issue_number = find_or_create_issue(repository, token, title)
    request_json(
        "POST",
        f"/repos/{repository}/issues/{issue_number}/comments",
        token,
        {"body": markdown},
    )
    return f"https://github.com/{repository}/issues/{issue_number}"


def find_or_create_issue(repository: str, token: str, title: str) -> int:
    issues = request_json("GET", f"/repos/{repository}/issues?state=open&per_page=100", token)
    for issue in issues:
        if issue.get("title") == title and "pull_request" not in issue:
            return int(issue["number"])

    created = request_json(
        "POST",
        f"/repos/{repository}/issues",
        token,
        {
            "title": title,
            "body": (
                "Hier postet die taegliche Wohnungssuche neue passende Inserate. "
                "Bereits gemeldete Wohnungen werden nicht wiederholt."
            ),
        },
    )
    return int(created["number"])


def request_json(method: str, path: str, token: str, payload: dict | None = None):
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{API_ROOT}{path}",
        data=data,
        method=method,
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "wohnungssuche-bot",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else None
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise GitHubIssueError(f"GitHub API failed ({exc.code}): {detail}") from exc

