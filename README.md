# Refund Tracker

Personal web app (PWA) to keep track of expenses awaiting a refund: health care (Sécurité sociale, Mutuelle) and returned purchases. Works offline on Android and desktop; data stays on the device.

## Development

```bash
npm install
npm run dev     # local dev server
npm test        # unit tests
npm run build   # type-check + production build in dist/
```

## Deployment

Every update of `main` is built and published on GitHub Pages by `.github/workflows/deploy.yml`
(repository Settings → Pages → Source: **GitHub Actions**). Pull requests run the unit and browser
tests (`.github/workflows/checks.yml`). The published site only contains the app: data stays in each
visitor's own browser.

The original single-file prototype is kept in `prototype/index.html` as the behaviour reference. Project notes and business rules are in `CLAUDE.md`.
