#!/usr/bin/env python3
"""Download Cue giveaway assets for a browser agent's local upload step.

This script does not send messages and does not require a webhook or token.
After downloading, the browser agent can pass the resulting files to Discord's
file input/upload control while operating the already-authenticated Discord UI.
"""

from __future__ import annotations

import argparse
import pathlib
import sys
import urllib.error
import urllib.request

ASSET_URLS = {
    "invite-autocomplete-example.png": "https://raw.githubusercontent.com/Sotarium/Cue/main/assets/giveaway/invite-autocomplete-example.png",
    "invite-command-example.png": "https://raw.githubusercontent.com/Sotarium/Cue/main/assets/giveaway/invite-command-example.png",
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output-dir",
        type=pathlib.Path,
        default=pathlib.Path("/tmp/cue-giveaway-assets"),
        help="Directory where the agent can read the downloaded files",
    )
    args = parser.parse_args()
    args.output_dir.mkdir(parents=True, exist_ok=True)

    for filename, url in ASSET_URLS.items():
        destination = args.output_dir / filename
        request = urllib.request.Request(
            url,
            headers={"User-Agent": "CueGiveawayAssetDownloader/1.0"},
        )
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                destination.write_bytes(response.read())
        except (urllib.error.URLError, OSError) as error:
            print(f"Could not download {filename}: {error}", file=sys.stderr)
            return 1
        print(destination)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
