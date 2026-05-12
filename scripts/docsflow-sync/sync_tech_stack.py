#!/usr/bin/env python3
"""
Thin DocsFlow MCP client: Bearer auth, get_prompt(tech_stack_editing_guide),
read tech-stack resource, merge allowlisted versions from package.json, edit_tech_stack_version.

Tech stack shape (DocsFlow): categories -> domain -> bucket -> list of
{ "name", "description", "link", "version" }. We match by exact "name" and set "version".

Secrets: DOCSFLOW_MCP_API_KEY (required), or MCP_TOKEN if the former is unset.
Never commit API keys.

Local: place variables in scripts/docsflow-sync/.env (same folder as this script).
They are loaded on startup and do not override variables already set in the shell.

Env:
  DOCSFLOW_MCP_API_KEY   required (or MCP_TOKEN if DOCSFLOW_MCP_API_KEY unset)
  MCP_SERVER_URL          default https://docsflow-mcp.wavemaker.ai/mcp
  DOCSFLOW_TECH_STACK_VERSION  default 1-0-1-beta
  PACKAGE_JSON            default ./package.json (repo root in CI)
  DOCSFLOW_PATH_MAP       optional path_map.json for extra legacy JSON path overrides

CLI:
  --dry-run              Print exact edit_tech_stack_version arguments JSON to stdout; no MCP edit.
  --print-tool-args      With a real run, print that JSON to stdout before calling the tool.
"""

from __future__ import annotations

import argparse
import asyncio
import copy
import json
import os
import sys
from pathlib import Path
from typing import Any

from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client

DEFAULT_MCP_URL = "https://docsflow-mcp.wavemaker.ai/mcp"
DEFAULT_TECH_STACK_VERSION = "1-0-1-beta"
PROMPT_NAME = "tech_stack_editing_guide"
EDIT_TOOL = "edit_tech_stack_version"
FULLCAL_PREFIX = "@fullcalendar/"

# DocsFlow "name" field -> (category, domain, bucket_key under domain)
# See tech_stack_editing_guide / dump: Application Stack UI Angular = one array of libs.
APP, BT, RT = "Application Stack", "Build Time", "Run Time"
UI = "UI"
ANG = "Angular"

# (allowlist_key, category, domain, bucket, docsflow_library_name)
# Bootstrap (CSS) stays at DocsFlow value (e.g. 3.3.7); not synced from package.json.
LIBRARY_CARD_TARGETS: list[tuple[str, str, str, str, str]] = [
    ("angular", APP, UI, ANG, "Angular"),
    ("jquery", APP, UI, ANG, "jQuery"),
    ("jquery_ui", APP, UI, ANG, "jQuery UI"),
    ("ngx_bootstrap", APP, UI, ANG, "ngx-bootstrap"),
    ("d3", APP, UI, ANG, "D3.js"),
    ("nvd3", APP, UI, ANG, "NVD3"),
    ("fullcalendar", APP, UI, ANG, "FullCalendar"),
    ("lodash_es", APP, UI, ANG, "Lodash (lodash-es)"),
    ("npm", BT, UI, ANG, "npm"),
    ("node", RT, UI, ANG, "Node.js"),
]


def _script_dir() -> Path:
    return Path(__file__).resolve().parent


def load_dotenv_file(path: Path) -> None:
    """KEY=value lines; # comments; does not override existing os.environ."""
    if not path.is_file():
        return
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            continue
        key, _, val = line.partition("=")
        key = key.strip()
        if not key:
            continue
        val = val.strip()
        if len(val) >= 2 and val[0] == val[-1] and val[0] in "\"'":
            val = val[1:-1]
        os.environ.setdefault(key, val)


def load_path_map(path: Path | None) -> dict[str, list[str]]:
    cfg_path = path or (_script_dir() / "path_map.json")
    if not cfg_path.is_file():
        return {}
    with open(cfg_path, encoding="utf-8") as f:
        data = json.load(f)
    paths = data.get("paths") or {}
    out: dict[str, list[str]] = {}
    for k, v in paths.items():
        if k.startswith("_"):
            continue
        if v is None:
            out[k] = []
        elif isinstance(v, list) and all(isinstance(x, str) for x in v):
            out[k] = v
        else:
            raise SystemExit(f"path_map.json paths.{k} must be a list of strings")
    return out


def extract_allowlisted_versions(pkg: dict[str, Any]) -> dict[str, str | None]:
    deps = pkg.get("dependencies") or {}
    engines = pkg.get("engines") or {}

    fc = {k: v for k, v in deps.items() if k.startswith(FULLCAL_PREFIX)}
    if fc:
        versions = set(fc.values())
        if len(versions) > 1:
            raise SystemExit(
                f"All {FULLCAL_PREFIX}* packages must share one version; got {fc}"
            )

    return {
        "angular": deps.get("@angular/core"),
        "jquery": deps.get("jquery"),
        "jquery_ui": deps.get("jquery-ui"),
        "ngx_bootstrap": deps.get("ngx-bootstrap"),
        "d3": deps.get("d3"),
        "nvd3": deps.get("@wavemaker/nvd3"),
        "fullcalendar": deps.get("@fullcalendar/core"),
        "lodash_es": deps.get("lodash-es"),
        "node": engines.get("node"),
        "npm": engines.get("npm"),
    }


def set_nested(root: dict[str, Any], segments: list[str], value: str) -> None:
    if not segments:
        raise ValueError("empty path")
    cur: Any = root
    for seg in segments[:-1]:
        if seg not in cur or not isinstance(cur[seg], dict):
            cur[seg] = {}
        cur = cur[seg]
    cur[segments[-1]] = value


def parse_resource_tech_stack(raw: str) -> tuple[dict[str, Any], Any]:
    """
    Return the inner object passed to edit_tech_stack_version (four top-level categories).

    Resource may wrap payload as { "version", "status", "data": { ... } }.
    """
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise SystemExit("tech stack resource must be a JSON object")
    if isinstance(data.get("data"), dict):
        return copy.deepcopy(data["data"]), data.get("status")
    if "tech_stack" in data and isinstance(data["tech_stack"], dict):
        return copy.deepcopy(data["tech_stack"]), data.get("status")
    if "techStack" in data and isinstance(data["techStack"], dict):
        return copy.deepcopy(data["techStack"]), data.get("status")
    return copy.deepcopy(data), None


def _get_library_bucket(
    root: dict[str, Any], category: str, domain: str, bucket: str
) -> list[dict[str, Any]] | None:
    try:
        c = root[category]
        if not isinstance(c, dict):
            return None
        d = c[domain]
        if not isinstance(d, dict):
            return None
        arr = d[bucket]
        if not isinstance(arr, list):
            return None
        return [x for x in arr if isinstance(x, dict)]
    except KeyError:
        return None


def merge_library_cards(
    tech_stack: dict[str, Any], versions: dict[str, str | None]
) -> dict[str, Any]:
    """Update { name, version, ... } entries per DocsFlow conventions."""
    out = copy.deepcopy(tech_stack)
    for key, category, domain, bucket, docs_name in LIBRARY_CARD_TARGETS:
        val = versions.get(key)
        if val is None or str(val).strip() == "":
            continue
        new_ver = str(val).strip()
        arr = _get_library_bucket(out, category, domain, bucket)
        if arr is None:
            print(
                f"Warning: bucket missing {category!r}/{domain!r}/{bucket!r} "
                f"(skip {key} -> {docs_name!r})",
                file=sys.stderr,
            )
            continue
        found = False
        for item in arr:
            if item.get("name") == docs_name:
                old = item.get("version")
                item["version"] = new_ver
                print(
                    f"  merge {docs_name!r} in {category}/{domain}/{bucket}: "
                    f"{old!r} -> {new_ver!r}",
                    file=sys.stderr,
                )
                found = True
                break
        if not found:
            print(
                f"Warning: no entry named {docs_name!r} in {category}/{domain}/{bucket}",
                file=sys.stderr,
            )
    return out


def merge_versions(
    tech_stack: dict[str, Any],
    versions: dict[str, str | None],
    paths: dict[str, list[str]],
) -> dict[str, Any]:
    """Optional path_map.json overrides (list of string keys from tech_stack root)."""
    out = copy.deepcopy(tech_stack)
    for key, path in paths.items():
        if not path:
            continue
        val = versions.get(key)
        if val is None or val == "":
            continue
        set_nested(out, path, str(val))
    return out


def tech_stack_equal(a: dict[str, Any], b: dict[str, Any]) -> bool:
    return json.dumps(a, sort_keys=True) == json.dumps(b, sort_keys=True)


def format_prompt_messages(prompt_result: Any) -> str:
    parts: list[str] = []
    for msg in prompt_result.messages or []:
        content = getattr(msg, "content", None)
        text = getattr(content, "text", None) if content is not None else None
        if text:
            parts.append(text)
    return "\n\n".join(parts)


def collect_tool_result_text(result: Any) -> str:
    parts: list[str] = []
    for c in getattr(result, "content", None) or []:
        t = getattr(c, "text", None)
        if t:
            parts.append(str(t))
    return "\n".join(parts).strip() if parts else ""


async def run_sync(
    *,
    mcp_url: str,
    api_key: str,
    version_id: str,
    package_json_path: Path,
    path_map: dict[str, list[str]],
    dry_run: bool,
    dump_only: bool,
    skip_prompt: bool,
    skip_edit_if_unchanged: bool,
    print_tool_args: bool,
) -> int:
    headers = {"Authorization": f"Bearer {api_key}"}

    async with streamablehttp_client(mcp_url, headers=headers) as streams:
        read_stream, write_stream, _ = streams
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()

            if not skip_prompt:
                print("--- MCP prompt: tech_stack_editing_guide ---", file=sys.stderr)
                try:
                    pr = await session.get_prompt(PROMPT_NAME, {})
                    print(format_prompt_messages(pr), file=sys.stderr)
                except Exception as e:
                    print(f"Error: get_prompt({PROMPT_NAME}) failed: {e}", file=sys.stderr)
                    return 1

            uri = f"tech-stack://{version_id}"
            print(f"Reading resource {uri} ...", file=sys.stderr)
            try:
                rc = await session.read_resource(uri)
            except Exception as e:
                print(f"Error: read_resource failed: {e}", file=sys.stderr)
                return 1

            raw_text = ""
            for item in rc.contents or []:
                raw_text = getattr(item, "text", None) or ""
                if raw_text:
                    break
            if not raw_text.strip():
                print("Error: empty tech stack resource body", file=sys.stderr)
                return 1

            if dump_only:
                try:
                    parsed = json.loads(raw_text)
                    print(json.dumps(parsed, indent=2))
                except json.JSONDecodeError:
                    print(raw_text)
                return 0

            tech_stack, _status = parse_resource_tech_stack(raw_text)

            with open(package_json_path, encoding="utf-8") as f:
                pkg = json.load(f)
            versions = extract_allowlisted_versions(pkg)

            print("Merging allowlisted package.json versions into tech_stack ...", file=sys.stderr)
            merged = merge_library_cards(tech_stack, versions)
            if any(path_map.get(k) for k in path_map):
                merged = merge_versions(merged, versions, path_map)

            tool_arguments: dict[str, Any] = {"version": version_id, "tech_stack": merged}
            if dry_run or print_tool_args:
                print(json.dumps(tool_arguments, indent=2))

            if skip_edit_if_unchanged and tech_stack_equal(tech_stack, merged):
                print(
                    "=== DOCSFLOW: SKIPPED — tech_stack unchanged vs remote; "
                    "edit_tech_stack_version not called (exit 0) ===",
                    file=sys.stderr,
                )
                return 0

            if dry_run:
                print(
                    "=== DOCSFLOW: DRY-RUN — payload printed to stdout; "
                    "no edit_tech_stack_version call (exit 0) ===",
                    file=sys.stderr,
                )
                return 0

            print(f"Calling {EDIT_TOOL} for version={version_id!r} ...", file=sys.stderr)
            try:
                result = await session.call_tool(
                    EDIT_TOOL,
                    tool_arguments,
                )
            except Exception as e:
                print(
                    f"=== DOCSFLOW: MCP call_tool transport/exception (exit 1) ===\n{e}",
                    file=sys.stderr,
                )
                return 1

            if getattr(result, "isError", False):
                body = collect_tool_result_text(result)
                print(
                    f"=== DOCSFLOW: {EDIT_TOOL} returned isError=true (exit 1) ===",
                    file=sys.stderr,
                )
                if body:
                    print(body, file=sys.stderr)
                sc = getattr(result, "structuredContent", None)
                if sc is not None:
                    print(
                        "structuredContent:\n" + json.dumps(sc, indent=2),
                        file=sys.stderr,
                    )
                if not body and sc is None:
                    print(repr(result), file=sys.stderr)
                return 1

            print(
                f"=== DOCSFLOW: {EDIT_TOOL} OK — server accepted update "
                f"(version={version_id!r}, exit 0) ===",
                file=sys.stderr,
            )
            if getattr(result, "structuredContent", None):
                print(json.dumps(result.structuredContent, indent=2))
            else:
                for c in result.content or []:
                    if getattr(c, "text", None):
                        print(c.text)
            return 0


def main() -> None:
    parser = argparse.ArgumentParser(description="DocsFlow thin MCP tech stack sync")
    parser.add_argument(
        "--dump-tech-stack",
        action="store_true",
        help="Print raw tech-stack resource JSON and exit (still logs editing guide unless --skip-prompt)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print exact edit_tech_stack_version arguments JSON to stdout, then exit without calling the tool",
    )
    parser.add_argument(
        "--print-tool-args",
        action="store_true",
        help="Print the same JSON to stdout before a real edit_tech_stack_version call (stderr for logs)",
    )
    parser.add_argument(
        "--skip-prompt",
        action="store_true",
        help="Skip get_prompt(tech_stack_editing_guide)",
    )
    parser.add_argument(
        "--force-edit",
        action="store_true",
        help="Call edit even when merged tech_stack equals fetched (default: skip)",
    )
    args = parser.parse_args()

    load_dotenv_file(_script_dir() / ".env")

    api_key = (
        os.environ.get("DOCSFLOW_MCP_API_KEY", "").strip()
        or os.environ.get("MCP_TOKEN", "").strip()
    )
    if not api_key:
        print(
            "Error: set DOCSFLOW_MCP_API_KEY or MCP_TOKEN (Bearer token for DocsFlow MCP).",
            file=sys.stderr,
        )
        sys.exit(1)

    mcp_url = os.environ.get("MCP_SERVER_URL", DEFAULT_MCP_URL).strip()
    version_id = os.environ.get("DOCSFLOW_TECH_STACK_VERSION", DEFAULT_TECH_STACK_VERSION).strip()
    pkg_path = Path(os.environ.get("PACKAGE_JSON", "package.json")).resolve()
    path_map_override = os.environ.get("DOCSFLOW_PATH_MAP")
    path_map_path = Path(path_map_override) if path_map_override else None

    path_map = load_path_map(path_map_path)

    if not pkg_path.is_file():
        print(f"Error: package.json not found at {pkg_path}", file=sys.stderr)
        sys.exit(1)

    skip_unchanged = not args.force_edit

    exit_code = asyncio.run(
        run_sync(
            mcp_url=mcp_url,
            api_key=api_key,
            version_id=version_id,
            package_json_path=pkg_path,
            path_map=path_map,
            dry_run=args.dry_run,
            dump_only=args.dump_tech_stack,
            skip_prompt=args.skip_prompt,
            skip_edit_if_unchanged=skip_unchanged,
            print_tool_args=args.print_tool_args,
        )
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
