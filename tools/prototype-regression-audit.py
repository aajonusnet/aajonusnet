from __future__ import annotations

from collections import Counter
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen
import re
import subprocess


ROOT = Path("/workspaces/aajonusnet")
PROTOTYPE = ROOT / "prototype"
INDEX = PROTOTYPE / "index.html"

ASSET_EXTENSIONS = {
    ".css",
    ".js",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".svg",
    ".ico",
    ".woff",
    ".woff2",
}

REQUIRED_FILES = [
    PROTOTYPE / "index.html",
    PROTOTYPE / "app.js",
    PROTOTYPE / "opening-animation.css",
    PROTOTYPE / "opening-animation.js",
    PROTOTYPE / "timeline-interactions.css",
    PROTOTYPE / "timeline-interactions.js",
    PROTOTYPE / "source-label-cleanup.js",
    PROTOTYPE / "intro-cache.js",
    PROTOTYPE / "intro-service-worker.js",
    PROTOTYPE /
        "assets/earthlight/alpine-mist.webp",
]


class AssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.references: list[str] = []

    def handle_starttag(
        self,
        tag: str,
        attrs: list[
            tuple[str, str | None]
        ],
    ) -> None:
        attributes = dict(attrs)

        for attribute in ("src", "href"):
            value = attributes.get(
                attribute
            )

            if value:
                self.references.append(
                    value
                )


def is_backup(path: Path) -> bool:
    lowered = str(path).lower()

    return (
        "before-" in lowered or
        "backup" in lowered
    )


def active_files(
    directory: Path,
    suffix: str,
) -> list[Path]:
    return sorted(
        path
        for path in directory.rglob(
            f"*{suffix}"
        )
        if (
            path.is_file() and
            not is_backup(path)
        )
    )


def run_command(
    command: list[str],
) -> tuple[bool, str]:
    result = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    output = (
        result.stdout +
        result.stderr
    ).strip()

    return (
        result.returncode == 0,
        output,
    )


def resolve_asset(
    reference: str,
) -> Path | None:
    parsed = urlsplit(reference)

    if parsed.scheme in {
        "http",
        "https",
        "data",
        "mailto",
        "tel",
    }:
        return None

    clean_path = parsed.path

    if (
        not clean_path or
        clean_path.startswith("#")
    ):
        return None

    suffix = Path(
        clean_path
    ).suffix.lower()

    if suffix not in ASSET_EXTENSIONS:
        return None

    if clean_path.startswith("/"):
        return (
            ROOT /
            clean_path.lstrip("/")
        ).resolve()

    return (
        PROTOTYPE /
        clean_path
    ).resolve()


def test_http(
    url: str,
) -> tuple[bool, str]:
    request = Request(
        url,
        headers={
            "User-Agent":
                "AajonusPrototypeAudit/1.0"
        },
    )

    try:
        with urlopen(
            request,
            timeout=4,
        ) as response:
            status = response.status

            return (
                200 <= status < 400,
                str(status),
            )
    except Exception as error:
        return (
            False,
            str(error),
        )


def values_matching(
    pattern: str,
    sources: list[Path],
) -> set[str]:
    matches: set[str] = set()
    compiled = re.compile(pattern)

    for source in sources:
        try:
            text = source.read_text(
                encoding="utf-8",
                errors="ignore",
            )
        except OSError:
            continue

        matches.update(
            compiled.findall(text)
        )

    return matches


errors: list[str] = []
warnings: list[str] = []

print()
print("=" * 68)
print("AAJONUS PROTOTYPE REGRESSION AUDIT")
print("=" * 68)

print()
print("[1/7] Required files")

for required in REQUIRED_FILES:
    relative = required.relative_to(
        ROOT
    )

    if required.exists():
        print("  PASS", relative)
    else:
        print("  FAIL", relative)

        errors.append(
            f"Missing required file: {relative}"
        )

if not INDEX.exists():
    print()
    print("AUDIT RESULT: FAIL")
    print(
        "prototype/index.html does not exist."
    )

    raise SystemExit(0)

html = INDEX.read_text(
    encoding="utf-8",
    errors="ignore",
)

parser = AssetParser()
parser.feed(html)

print()
print("[2/7] Referenced local assets")

missing_assets: list[str] = []

for reference in parser.references:
    resolved = resolve_asset(reference)

    if (
        resolved is not None and
        not resolved.exists()
    ):
        missing_assets.append(reference)

if missing_assets:
    for reference in sorted(
        set(missing_assets)
    ):
        print("  FAIL", reference)

        errors.append(
            f"Missing referenced asset: {reference}"
        )
else:
    print(
        "  PASS All referenced CSS, JavaScript, "
        "images and fonts exist."
    )

print()
print("[3/7] Duplicate script and stylesheet references")

normalized_references = []

for reference in parser.references:
    parsed = urlsplit(reference)
    path = parsed.path

    if Path(path).suffix.lower() in {
        ".js",
        ".css",
    }:
        normalized_references.append(path)

duplicates = {
    reference: count
    for reference, count in
        Counter(
            normalized_references
        ).items()
    if count > 1
}

if duplicates:
    for reference, count in sorted(
        duplicates.items()
    ):
        print(
            "  WARN",
            reference,
            f"appears {count} times",
        )

        warnings.append(
            f"Duplicate reference: {reference}"
        )
else:
    print(
        "  PASS No duplicate CSS or JavaScript references."
    )

print()
print("[4/7] JavaScript syntax")

javascript_files = active_files(
    PROTOTYPE,
    ".js",
)

javascript_failures = 0

for script in javascript_files:
    passed, output = run_command(
        [
            "node",
            "--check",
            str(script),
        ]
    )

    if not passed:
        javascript_failures += 1

        relative = script.relative_to(
            ROOT
        )

        print("  FAIL", relative)

        if output:
            print(
                "       ",
                output.replace(
                    "\n",
                    "\n        ",
                ),
            )

        errors.append(
            f"JavaScript syntax error: {relative}"
        )

if javascript_failures == 0:
    print(
        f"  PASS {len(javascript_files)} "
        "active JavaScript files checked."
    )

print()
print("[5/7] PHP syntax")

php_candidates = [
    ROOT / "router.php",
    *active_files(
        PROTOTYPE,
        ".php",
    ),
    *active_files(
        ROOT / "code",
        ".php",
    ),
]

php_files = []
seen_php = set()

for php_file in php_candidates:
    if (
        php_file.exists() and
        php_file not in seen_php
    ):
        seen_php.add(php_file)
        php_files.append(php_file)

php_failures = 0

for php_file in php_files:
    passed, output = run_command(
        [
            "php",
            "-l",
            str(php_file),
        ]
    )

    if not passed:
        php_failures += 1

        relative = php_file.relative_to(
            ROOT
        )

        print("  FAIL", relative)

        if output:
            print(
                "       ",
                output.replace(
                    "\n",
                    "\n        ",
                ),
            )

        errors.append(
            f"PHP syntax error: {relative}"
        )

if php_failures == 0:
    print(
        f"  PASS {len(php_files)} "
        "active PHP files checked."
    )

print()
print("[6/7] Feature connections")

required_references = {
    "opening-animation.js":
        "Opening animation",

    "intro-cache.js":
        "Intro cache warmer",

    "timeline-interactions.js":
        "Functional timeline",

    "source-label-cleanup.js":
        "Clean source labels",
}

reference_paths = {
    Path(
        urlsplit(reference).path
    ).name
    for reference in parser.references
}

for filename, label in required_references.items():
    if filename in reference_paths:
        print(
            f"  PASS {label}: {filename}"
        )
    else:
        print(
            f"  FAIL {label}: {filename}"
        )

        errors.append(
            f"{label} is not attached to index.html"
        )

active_sources = [
    INDEX,
    PROTOTYPE /
        "opening-animation.js",
    PROTOTYPE /
        "intro-cache.js",
    PROTOTYPE /
        "intro-service-worker.js",
]

ready_keys = values_matching(
    r"aajonusIntroAssetsReadyV\d+",
    active_sources,
)

cache_names = values_matching(
    r"aajonus-intro-assets-v\d+",
    active_sources,
)

last_seen_keys = values_matching(
    r"aajonusIntroLastSeenV\d+",
    active_sources,
)

print(
    "  INFO Ready keys:",
    ", ".join(sorted(ready_keys))
        or "none",
)

print(
    "  INFO Cache names:",
    ", ".join(sorted(cache_names))
        or "none",
)

print(
    "  INFO Last-seen keys:",
    ", ".join(
        sorted(last_seen_keys)
    ) or "none",
)

if len(ready_keys) > 1:
    warnings.append(
        "Multiple intro-ready storage versions are active."
    )

if len(cache_names) > 1:
    warnings.append(
        "Multiple active intro cache versions were detected."
    )

legacy_markers = [
    "SUN-INTRO-PREFLIGHT",
    "NATURE-INTRO-PREFLIGHT",
    "FAST-SUN-INTRO-PREFLIGHT",
    "CINEMATIC-INTRO-V5",
    "SUNRISE-INTRO-V6",
]

found_legacy = [
    marker
    for marker in legacy_markers
    if marker in html
]

if found_legacy:
    print(
        "  WARN Legacy markers:",
        ", ".join(found_legacy),
    )

    warnings.append(
        "Legacy intro marker comments remain in index.html."
    )
else:
    print(
        "  PASS No abandoned intro marker blocks remain."
    )

print()
print("[7/7] Local HTTP checks")

http_tests = [
    (
        "Homepage",
        "http://127.0.0.1:8000/prototype/",
    ),
    (
        "Year-filter URL",
        "http://127.0.0.1:8000/prototype/?year=2012",
    ),
    (
        "Search metadata endpoint",
        "http://127.0.0.1:8000/code/loadsearch-meta.php",
    ),
]

for label, url in http_tests:
    passed, detail = test_http(url)

    if passed:
        print(
            f"  PASS {label}: HTTP {detail}"
        )
    else:
        print(
            f"  WARN {label}: {detail}"
        )

        warnings.append(
            f"HTTP test unavailable: {label}"
        )

backup_files = [
    path
    for path in PROTOTYPE.iterdir()
    if (
        path.is_file() and
        (
            "before-" in path.name or
            "backup" in path.name.lower()
        )
    )
]

print()
print("Backup files retained:", len(backup_files))

print()
print("-" * 68)

if errors:
    print(
        f"AUDIT RESULT: FAIL "
        f"({len(errors)} error(s), "
        f"{len(warnings)} warning(s))"
    )

    print()
    print("Errors:")

    for error in errors:
        print("  -", error)
elif warnings:
    print(
        f"AUDIT RESULT: PASS WITH "
        f"{len(warnings)} WARNING(S)"
    )

    print()
    print("Warnings:")

    for warning in warnings:
        print("  -", warning)
else:
    print("AUDIT RESULT: PASS")

print("-" * 68)
