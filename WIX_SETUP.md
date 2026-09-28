# MDK Field App with Wix

## Recommended: keep Wix, open the app separately

Keep the main MDK website on Wix. Host the app as a standalone static website and link an **Open MDK Field App** button to its final HTTPS address. A suggested address is `field.mdkelectric.ca`; this is a proposal, not a configured address.

The previous mobile iframe setup still had reported scroll and bottom-menu issues. Do not treat a fixed 780px embed or extra Safari padding as a verified universal fix. Opening the app as a top-level page removes the nested Wix/frame scrolling arrangement. Test on the actual phone before rollout.

For Cloudflare Pages, first add the chosen subdomain under the project's **Custom domains**. Then add the exact CNAME supplied by Cloudflare at the domain's actual DNS provider (Wix if Wix manages the DNS). Do not change the main website's nameservers, root domain, www, or email records just to add this subdomain. Do not overwrite an existing subdomain without checking its purpose.

Once the domain and HTTPS are active, use that same final address for everyone. Avoid storing production records at a temporary preview URL, since storage is associated with the browser origin.

## Can Wix host the files itself?

Wix Headless offers static HTML/CSS/JavaScript uploads at https://www.wix.com/headless/drop and accepts a folder or ZIP. Wix says this is not available to all users. It creates a Headless site; it is not a file upload into the existing Wix Editor page. Confirm account availability, custom-domain cost, and whether an existing paid plan covers this separate site before choosing it. Test PDF export, service-worker/offline support, and phone layout on the resulting URL.

Use the website-only ZIP, not the outer recovery kit. An ordinary Wix page embed is not independent hosting: it still relies on the external URL inside it.

## Home-screen installation and records

Open the final standalone URL in Safari on iPhone, then use **Share → Add to Home Screen**. On Android, use Chrome's install/add-to-home-screen option. Test the full scroll range with and without the keyboard in browser and installed modes.

Export backups from the old app before changing addresses if it is still accessible, including an installed/offline copy. Do not clear site data or uninstall the old app during recovery. Import into the final address. Records do not automatically migrate or sync between devices. Export any existing destination records before restoring a backup.

## Official references (checked 2026-09-28)

- https://support.wix.com/en/article/wix-headless-uploading-a-static-site
- https://support.wix.com/en/article/connecting-a-subdomain-to-an-external-resource
- https://developers.cloudflare.com/pages/configuration/custom-domains/
