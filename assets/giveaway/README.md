# Giveaway assets

These are the supplied Discord screenshots used as giveaway/command references.
They are intentionally kept as original PNG files so Cue can fetch them into
its own workspace without relying on a folder on the user's computer.

## Prepare files for Cue's browser upload

The Giveaway Boat channel does not need to be owned by you, so a webhook is
not appropriate. Cue can download these public files into its own workspace,
then upload them through the already-authenticated Discord browser session:

```bash
python3 scripts/download_giveaway_assets.py
```

The default output is `/tmp/cue-giveaway-assets/`. Cue must then use Discord's
actual file-upload control with those local paths, wait for the upload preview,
and send the message. Typing a filename or URL into the message box will not
create an attachment.
