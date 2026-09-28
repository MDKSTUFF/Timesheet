# MDK Field App recovery kit

Prepared 2026-09-28 from the last retained version 10 source, commit `e5fa6e92b55a8d5f1de719425f8dbe79c0467948`. Access to the old GitHub account is not required. No hosting account, repository, domain, or Wix page has been changed by packaging this kit.

## Which ZIP do I use?

- **MDK-Field-App-Repository.zip**: complete source snapshot, tests, GitHub Pages workflow, and updated documentation. Extract before uploading to a new repository. No old Git history or account credentials are included.
- **MDK-Field-App-Website.zip**: ready-to-serve website files for Cloudflare Pages, Netlify, Wix Headless, or ordinary hosting. `index.html` is at the ZIP root. No build or dependency installation is needed.

Do not upload the outer recovery kit as the website. Pick one of the inner ZIPs. Keep this kit offline as a backup.

## First: protect saved records

This kit contains app code and branding, NOT your saved work orders, timesheets, quotes, or browser settings. Those are stored locally in each browser, associated with its website address. Changing hosts does not automatically transfer them.

If the old app still opens, including an installed/offline copy, use **More → Export full backup** and keep the JSON safely. Do this on each device/browser with records. Do not clear browser/site data or uninstall the old app. Export any existing destination records before importing: restore can replace them. Import at the final new HTTPS address, verify the records, and retain the original JSON.

If the old address cannot open and no backup exists, code files alone cannot recover the records. Preserve the old browser data while recovery is investigated. Never upload backup JSON or customer documents to a public repository or website.

## Recommended: Cloudflare Pages Direct Upload

1. Sign in to your own Cloudflare account and open **Workers & Pages**.
2. Create a **Pages** project using **Direct Upload / Drag and drop**, not Git integration.
3. Upload **MDK-Field-App-Website.zip** (or its extracted contents) and deploy. No build command is needed.
4. Open the supplied HTTPS `pages.dev` address and run the checklist below.
5. Optionally configure a stable custom subdomain before importing production records.

Cloudflare offers a Pages Free plan. Direct Upload works without GitHub. Account/usage limits and provider terms still apply. A Direct Upload project cannot later switch to Git integration; create a new project if needed.

## Keep Wix and use your own app address

Suggested setup: Wix serves the business website; `field.mdkelectric.ca` serves the standalone app. That proposed subdomain is not configured yet.

In Cloudflare Pages, first add the subdomain under **Custom domains**. At your actual DNS provider, add the requested CNAME to the project's `pages.dev` hostname. A subdomain does not require moving the root domain's nameservers to Cloudflare. Leave the main Wix website and email records alone. Wait for domain validation and HTTPS.

In Wix, add an **Open MDK Field App** button linking to the final standalone URL. Avoid a mobile iframe: the earlier embed still had reported scroll problems, and packaging does not fix them. A standalone page removes that nested scrolling arrangement. Verify on the actual phone before rollout.

## Other options

### Netlify

Use Netlify Drop/manual deployment with the extracted website folder. No GitHub connection is required. The Free plan has usage/credit limits; review them before choosing a plan. Test at a stable final URL before importing records.

### Wix Headless

Wix supports static folder/ZIP uploads at https://www.wix.com/headless/drop (up to 20 MB). This package fits that size limit. The feature is not available to every user and creates a Headless site, not an upload into the existing Wix Editor page. Save/manage it in your Wix account. Confirm pricing, custom-domain requirements, and existing plan coverage. This host has not been tested for this app's PDF, offline, or install behavior.

### Your own ordinary hosting

If you have a hosting account with a file manager or SFTP and permission to serve HTML/CSS/JavaScript, extract the website ZIP into a new app directory or subdomain document root. Preserve folders and put `index.html` directly in that root. Do not overwrite your main website. Serve over HTTPS with JavaScript and JSON/manifest MIME types supported. No PHP, database, Node server, or build step is required at runtime. Opening an HTML file directly from your computer is not equivalent to hosting it.

## Upload to another GitHub repository

Use a repository/account you are authorized to use; a new repository does not resolve an account suspension. Resolve access restrictions through GitHub support where needed.

### Easiest browser upload: website ZIP

1. Create a repository on an accessible authorized account. GitHub Free Pages supports public repositories; do not add private data.
2. Extract **MDK-Field-App-Website.zip**.
3. Use **Add file → Upload files** and upload the extracted files and folders to the root of `main`, preserving `assets/` and `vendor/`. Uploading a ZIP itself will NOT create a working site.
4. Open **Settings → Pages → Source → Deploy from a branch**; choose **main** and **/(root)**, then Save.
5. Open the exact published address shown in Pages settings. No hardcoded old-owner address needs changing in the runtime.

### Full development repository: repository ZIP

Extract **MDK-Field-App-Repository.zip** and commit all files, including `.github/workflows/deploy-pages.yml` and `.nojekyll`, to `main`. On macOS, Command-Shift-period shows hidden files. In **Settings → Pages → Source**, choose **GitHub Actions**, then run **Deploy to GitHub Pages** from Actions or push to main. Choose this workflow route instead of also configuring branch publishing. Keep `main` unless you update the workflow trigger.

Locally, `npm test` runs syntax and calculation checks. `npm run serve` starts a Python static server on port 4173; Node/npm and Python are development tools, not production requirements.

## Acceptance checklist before field use

- Open the final HTTPS address directly, not inside the Wix frame.
- Test Dashboard, Work Orders, Timesheets, Quotes, and More.
- In every editor, scroll normally to the last field/action and back up. Check the menu with Safari toolbars expanded/collapsed, portrait/landscape, and keyboard open/closed.
- Confirm dates fit their cards, Week Ending updates daily dates, and all seven Set 8h buttons work.
- Create a disposable record, reload, reopen it, and verify saving.
- Generate/download a PDF and test native sharing on the phone when available.
- Export a backup. Verify restore in a disposable/test browser before restoring production data.
- After one online visit, test offline reopening and home-screen installation at the final address.
- Do not clear production browser storage during testing.

## Verification and limitations

Runtime code is unchanged. JavaScript syntax and the existing calculation tests pass. All local logo/icons and PDF library files are included, with relative asset paths. Package/file checks are not live-host or physical iPhone tests. The earlier Wix iframe issue and slight browser-mode menu offset are not claimed fixed here.

## Reduce future downtime

No provider guarantees an account will never be restricted. Keep this kit plus regular per-device JSON backups in two places, enable two-factor authentication, and securely retain recovery codes. A subdomain you control allows future hosting changes without changing the familiar address. Keep domain/DNS access recoverable too. The app has no login or automatic cloud sync; a Wix page password does not protect a separately hosted app URL.

## Official references (checked 2026-09-28)

- https://developers.cloudflare.com/pages/get-started/direct-upload/
- https://developers.cloudflare.com/pages/platform/limits/
- https://developers.cloudflare.com/pages/configuration/custom-domains/
- https://docs.netlify.com/start/quickstarts/netlify-drop-quickstart/
- https://www.netlify.com/pricing/
- https://support.wix.com/en/article/wix-headless-uploading-a-static-site
- https://support.wix.com/en/article/connecting-a-subdomain-to-an-external-resource
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
