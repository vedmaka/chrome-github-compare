# GitHub Commit Compare

Select two commits on a GitHub commit list and open GitHub's comparison page. The first selection stays in place while you try different second commits

## Install

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Select **Load unpacked**
4. Select this project directory

## Use

1. Open a GitHub commit-list page such as `https://github.com/WikiTeq/Taqasta/commits/master/`
2. Select two commits with the GitHub-style checkboxes at the right of the commit rows
3. Select the **Compare `older7..newer7`** button

The compare button appears beside the branch selector only while two commits are selected. Its label shows both seven-character commit hashes in older-to-newer order. The extension always uses the older commit as the base and the newer commit as the head, regardless of selection order. Selecting a third commit keeps the first selection and replaces the second

The comparison opens in the current tab with GitHub's standard URL format:

```text
https://github.com/owner/repository/compare/base..head
```

## Development

Run all tests:

```bash
npm test
```

Check JavaScript syntax:

```bash
npm run lint
```

Project files:

- `manifest.json` defines the GitHub-only Manifest V3 content script
- `src/compare.js` validates and orders commits and creates compare URLs
- `src/content.js` adds selection controls and rescans after GitHub replaces commit rows or branch controls
- `src/styles.css` uses GitHub theme variables for the injected controls
- `tests/` contains dependency-free Node.js tests

## Privacy and permissions

The content script loads on GitHub repository pages so it can handle in-page navigation. It adds controls only on commit-list pages. It uses no optional Chrome API permissions, backend, analytics, or persistent storage. See [PRIVACY.md](PRIVACY.md) for data handling

The [GitHub Pages privacy page](docs/index.html) uses the same policy. To publish it, push this change, then set **Settings → Pages → Build and deployment → Deploy from a branch → `master` → `/docs`**. After GitHub completes deployment, use `https://vedmaka.github.io/chrome-github-compare/` as the Chrome Web Store privacy-policy URL

## Localization

The interface and manifest support English, Russian, Spanish, Serbian (Cyrillic), Croatian, Finnish, Hindi, and Indonesian through Chrome's `_locales/` catalogs.

## Chrome Web Store package

Regenerate the icon and listing graphics from the supplied root images with `npm run assets`. Build the upload ZIP with `npm run package`. The full release gate is `npm run release:check`

For a local browser hydration check, run `playwright-cli -s=hydration-check open`, then `playwright-cli -s=hydration-check run-code --filename=scripts/browser-hydration-check.js`, then close the session. The check intercepts a GitHub URL with a local fixture and makes no GitHub network request
