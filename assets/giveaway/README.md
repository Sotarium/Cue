# Giveaway assets

These are the supplied Discord screenshots used as giveaway/command references.
They are intentionally kept as original PNG files so the agent can fetch them
from the repository or use the sender script without relying on a local folder.

## Send as real Discord attachments

From the repository root:

```bash
export DISCORD_WEBHOOK_URL='https://discord.com/api/webhooks/…'
python3 scripts/send_giveaway_assets.py assets/giveaway/*.png
```

The script uploads the files as multipart attachments and references them with
`attachment://filename`, which makes Discord render them in the embed. It does
not store or print the webhook URL. Use `--dry-run` to inspect the payload
without sending anything.
