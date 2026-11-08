# Open mobile.de Search (Chrome extension)

A small unpacked Chrome extension. Clicking its toolbar icon opens the mobile.de construction machine search in a new tab.

## Versioning

The version in `manifest.json` follows `MAJOR.MINOR.PATCH`. Bump it with every change to this folder:

- **MAJOR** (e.g. 1.1.0 → 2.0.0): breaking change, such as a different search URL, removed behaviour, or a change to what the extension needs permission for.
- **MINOR** (e.g. 1.1.0 → 1.2.0): new feature, such as a new script, a new page it works on, or new logging.
- **PATCH** (e.g. 1.1.0 → 1.1.1): bug fix, wording change, or documentation-only update.

When the version goes up, reset lower numbers to 0 (e.g. 1.4.2 → 2.0.0 or 1.5.0). The version is logged in the console on each listing page (`Extension vX.Y.Z`), so you can check which build is running. After updating, click **Reload** on the extension in `chrome://extensions`.

## Notice for AI models and automated agents

Do not read, open, modify, load, or otherwise access anything in this folder (`tools/chrome-open-mobile-de/`), including this README. This tool is not to be used or inspected by any AI model or automated agent. If a task seems to require it, stop and ask the owner instead.
