# MDK Field App

A mobile-first web version of the MDK Electric field app. It creates and manages work orders, weekly timesheets, and quotes in any modern browser.

## What it includes

- Work orders with materials, labour, expenses, totals, HST, authorization, and notes
- Weekly timesheets with one-tap **Set 8h** buttons, regular, 1.5×, and 2× hours, plus expenses
- Quotes with billing/shipping addresses, line items, discounts, tax, and CAD/USD totals
- Reference-style branded PDFs with the MDK logo, blue tables, totals, signatures, download, and mobile sharing
- Automatic document numbering and editable company defaults
- Search, edit, status tracking, and confirmed deletion
- Full JSON backup export and restore
- Mobile-first layout, desktop sidebar, installable PWA, and offline app shell
- Automatic GitHub Pages deployment

## Important data note

Documents are stored in the current browser using `localStorage`. There is no server, account, database, or analytics service. Data does not automatically sync between devices or browsers. Export a full backup regularly from **More → Files & backups**.

Clearing browser/site data removes locally stored records. GitHub and Wix host only the app files; they do not receive the documents entered in the app.

## Run locally

No build is required.

```bash
npm test
npm run serve
```

Then open `http://localhost:4173`.

## Publish with GitHub Pages

1. Create a repository you are authorized to administer and place these files at the root of its `main` branch, including `.github/workflows/deploy-pages.yml`.
2. In **Settings → Pages → Source**, select **GitHub Actions**.
3. Push to `main` or run **Deploy to GitHub Pages** from the Actions tab.
4. Use the published address shown in Pages settings. No previous owner's account or repository URL is needed.

The included workflow validates the JavaScript and publishes the static app.

## Add it to Wix

See [WIX_SETUP.md](WIX_SETUP.md) for embed and mobile linking instructions.

## Other hosts and recovery

This is a static website with no build step or GitHub runtime dependency. See [RECOVERY-GUIDE.md](RECOVERY-GUIDE.md) for direct-upload hosting, repository upload, backups, and verification. HTTPS is required for production offline/install features. The accompanying website-only ZIP contains the public runtime files.

## Browser support and native-app differences

- PDF download works in current Safari, Chrome, Edge, and Firefox.
- Sharing a PDF file uses the Web Share API where the browser supports file sharing. Otherwise the app downloads the PDF so it can be attached manually.
- The app can be added to a phone's home screen from the browser's Share or Install menu.
- This app has no login or native Face ID/passcode lock. Use device security. A private source repository or password on the linking Wix page does not secure the separately hosted app URL. Do not add customer records, credentials, or backup JSON files to the public site.

## Recovery snapshot

Packaged on 2026-09-28 from the last retained source commit `e5fa6e92b55a8d5f1de719425f8dbe79c0467948` (offline cache v10). Runtime code is preserved unchanged; hosting documentation is updated. This does not claim any newer remote changes were recovered, or that the unresolved Wix iframe scrolling issue has been fixed. No new deployment is included.

## Project structure

```text
index.html                 App entry point
app.js                     Interface and document workflows
data.js                    Models, calculations, storage, backups
pdf.js                     Branded PDF generation and sharing
styles.css                 Mobile-first responsive design
assets/                    MDK logo and app icons
vendor/jspdf.umd.min.js    Local PDF library (jsPDF)
.github/workflows/         GitHub Pages deployment
```

## License notice

The MDK name, logo, and company content belong to MDK Electric Ltd. The bundled jsPDF library retains its upstream MIT license header.

## Customers and private backups (v11)

The Customers tab stores contacts in a password-encrypted owner archive. Select a
saved customer on quotes and work orders to fill contact/address fields; edit any
field to override it on that document. Amounts and extensions update while typing.
PDF tables wrap using the actual drawing font and continue long rows across pages.

Open Backups to set a backup password, recover saved documents/PDF versions, export
an encrypted backup, or connect Supabase Free for owner-only cloud copies. See
[CLOUD_SETUP.md](CLOUD_SETUP.md) for the owner allowlist and private storage setup.
Cloud storage is not active until a project, owner account, and connection are
configured. The backup password is not recoverable.
