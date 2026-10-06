# Private customer database and backups

Use a dedicated **Supabase Free** project. The website remains on GitHub Pages.
Customer records and archives use AES-256-GCM encryption with a password-derived
key (PBKDF2-SHA256, 310,000 iterations and random salt). The password never goes
into the repository, cloud connection settings, or cloud files.

## One-time owner setup

1. Create a Supabase Free project. Apply `supabase/private-backups.sql` in its SQL editor.
2. In Authentication, create your owner email/password user (auto-confirm it).
   Disable public signups in Authentication settings.
3. Copy that user's UUID. Insert it into `public.mdk_owners` using the commented
   SQL statement at the bottom of the setup file. Only that account can read/upload.
4. Open **Backups** in MDK Field. Enter your project URL and **publishable / anon**
   key, save the connection, then sign in with your owner email and account password.
   Never use a secret or service-role key in the app.
5. Create the private archive with a backup password and keep that password safe.
   It cannot be reset to decrypt old files. You may use a separate account password.
6. Press **Back up now** to include all previously saved documents.

Every document Save and PDF Save/Share keeps an encrypted local archive first.
While signed in, it automatically uploads an immutable encrypted cloud snapshot.
Editable documents and generated PDFs also go under their respective folders:
`<owner UUID>/quotes/`, `timesheets/`, `workOrders/`, and `backups/`.
Backup snapshots contain customers, settings, editable document versions and a
manifest of all saved PDFs. Cloud restore downloads and decrypts the referenced
PDF files automatically; downloaded local backups contain PDF bytes directly. Existing documents are retained; PDFs exported before this update cannot
be recovered unless you regenerate or otherwise still have the original files.

## Another device / recovery

Open the same website, enter the project connection, sign in, select a cloud backup,
enter its **backup password**, and restore. You can do this even before creating a
local archive. The same Customers dropdown and saved PDF versions are then available.
Restore the latest relevant version before editing on another device. Backups are
immutable versions, not collaborative realtime merging: restoring replaces the
current device's records, so export its current encrypted backup first if needed.

You can also download an encrypted `.mdkbackup` file and restore it offline.
The default editing lists still use the app's existing device-local storage;
Customers and archive data are encrypted and require unlocking. Downloaded PDFs
and legacy JSON backups are ordinary unencrypted files; protect them yourself.

## Limits / failure recovery

The Free plan includes 500 MB database storage and 1 GB file storage; projects may
pause after a week of inactivity. Supabase's paid automatic database backups are
not required: this app writes its own encrypted file snapshots. Local snapshots include archived PDF versions. Cloud snapshots reference individually
encrypted PDF files, which are uploaded once per version, to avoid duplicating PDF
contents in every cloud backup. Monitor Storage usage and remove
old cloud versions in the dashboard after downloading any versions you need.
The bucket limits uploads to 50 MB per object. A failed upload never reports cloud
success: local encrypted copies remain and the Backups tab shows a retry message.
Sign in and use **Back up now** after reconnecting. This uploads the complete local
archive, including PDFs saved offline. Do not clear browser storage until a cloud
upload or downloaded encrypted backup succeeds.

Sessions remain in memory and end on reload or Lock/Sign out. Close the app or press
**Lock private data** when done on a shared device. Public website source and project
public keys grant no cloud access; authorization is enforced by storage RLS and the
owner allowlist. No customer or document content belongs in the public GitHub repo.
