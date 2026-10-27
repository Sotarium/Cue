#!/usr/bin/env python3
"""Send local giveaway images to Discord as real attachments and embed images.

Usage:
  DISCORD_WEBHOOK_URL='https://discord.com/api/webhooks/...' \
    python3 scripts/send_giveaway_assets.py assets/giveaway/*.png

The webhook URL is read only from the environment and is never stored in this
repository. Each image is uploaded as a Discord attachment and referenced by
its attachment:// URL in the embed, so Discord renders the image instead of
showing a plain filename or broken link.
"""

from __future__ import annotations

import argparse
import json
import mimetypes
import os
import pathlib
import sys
import urllib.error
import urllib.parse
import urllib.request
import uuid


def multipart_form(fields: dict[str, str], files: list[tuple[str, str, bytes, str]]) -> tuple[bytes, str]:
    boundary = f"----CueGiveaway{uuid.uuid4().hex}"
    chunks: list[bytes] = []

    for name, value in fields.items():
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode(),
                value.encode(),
                b"\r\n",
            ]
        )

    for field_name, filename, content, content_type in files:
        chunks.extend(
            [
                f"--{boundary}\r\n".encode(),
                (
                    f'Content-Disposition: form-data; name="{field_name}"; '
                    f'filename="{filename}"\r\n'
                ).encode(),
                f"Content-Type: {content_type}\r\n\r\n".encode(),
                content,
                b"\r\n",
            ]
        )

    chunks.append(f"--{boundary}--\r\n".encode())
    return b"".join(chunks), f"multipart/form-data; boundary={boundary}"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("images", nargs="+", type=pathlib.Path)
    parser.add_argument("--content", default="", help="Optional message content")
    parser.add_argument("--title", default="Giveaway assets")
    parser.add_argument("--description", default="Images uploaded by Cue")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    webhook = os.environ.get("DISCORD_WEBHOOK_URL", "").strip()
    if not webhook and not args.dry_run:
        print("Missing DISCORD_WEBHOOK_URL", file=sys.stderr)
        return 2
    if webhook and urllib.parse.urlparse(webhook).netloc != "discord.com":
        print("DISCORD_WEBHOOK_URL must point to discord.com", file=sys.stderr)
        return 2

    files: list[tuple[str, str, bytes, str]] = []
    image_urls: list[str] = []
    for index, path in enumerate(args.images):
        if not path.is_file():
            print(f"Not a file: {path}", file=sys.stderr)
            return 2
        filename = path.name
        content_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        files.append((f"files[{index}]", filename, path.read_bytes(), content_type))
        image_urls.append(f"attachment://{filename}")

    embeds = []
    for index, image_url in enumerate(image_urls):
        embed = {"color": 0x5865F2, "image": {"url": image_url}}
        if index == 0:
            embed["title"] = args.title
            embed["description"] = args.description
        embeds.append(embed)
    payload = {"content": args.content, "embeds": embeds, "attachments": []}
    body, content_type = multipart_form(
        {"payload_json": json.dumps(payload)}, files
    )

    if args.dry_run:
        print(json.dumps({"payload": payload, "files": [str(p) for p in args.images]}, indent=2))
        return 0

    request = urllib.request.Request(
        webhook,
        data=body,
        headers={"Content-Type": content_type, "User-Agent": "CueGiveawayAssetSender/1.0"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            print(f"Discord accepted upload: HTTP {response.status}")
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", "replace")
        print(f"Discord rejected upload: HTTP {error.code}: {detail}", file=sys.stderr)
        return 1
    except urllib.error.URLError as error:
        print(f"Upload failed: {error.reason}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
