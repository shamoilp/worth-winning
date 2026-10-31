# Lead sheet setup (about 5 minutes)

The calculator sends each unlock (name, email or WhatsApp, and the deal numbers) to a Google Sheet you own, through a small Apps Script web app. Until it's set up, the PDF and share link stay open to everyone.

## 1. Add the script to your sheet

1. Open your lead sheet in Google Sheets (**WIWI Calculator Leads** in your Drive). Row 1 holds the column headers; the script adds them if the sheet is empty.
2. Click **Extensions → Apps Script**.
3. Delete everything in `Code.gs`, paste in the contents of [`Code.gs`](Code.gs), and click **Save** (💾).
4. Click **⚙️ Project Settings** (left bar) and tick **Show "appsscript.json" manifest file in editor**.
5. Back in **Editor**, open `appsscript.json`, replace everything with the contents of [`appsscript.json`](appsscript.json), and **Save**. This limits the script to this one spreadsheet.

## 2. Deploy it as a web app

1. Click **Deploy → New deployment**.
2. Click the ⚙️ next to "Select type" and pick **Web app**.
3. Set:
   - **Description:** `WIWI leads`
   - **Execute as:** `Me`
   - **Who has access:** `Anyone`
4. Click **Deploy**, then **Authorize access**, and choose your Google account.
   - Google warns "Google hasn't verified this app". That's normal for your own script: click **Advanced → Go to (project name) (unsafe)** → **Allow**.
   - The permission screen should say it can *"View and manage spreadsheets that this application has been installed in"*: this one sheet only, not your other files. If it asks for more, step 1.5 was skipped.
5. Copy the **Web app URL**. It ends in `/exec`.

## 3. Switch it on

Paste the URL into `index.html`:

```html
<meta name="lead-endpoint" content="https://script.google.com/macros/s/…/exec">
```

Commit and push. GitHub Pages updates in about a minute.

## Checking it works

- Open the `/exec` URL in a browser. You should see `{"ok":true,"service":"wiwi-leads"}`.
- Unlock a report on the live calculator. A new row appears in the sheet within a few seconds.

## Changing the script later

Edit `Code.gs`, then **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. This keeps the same URL. A *new* deployment would get a new URL, and you'd have to update `index.html` again.

## What it guards against

| Risk | Guard |
|---|---|
| Bots filling the form | A hidden field people never see; anything that fills it is silently dropped |
| Floods of fake submissions | At most 30 saved per 10 minutes |
| Formulas typed into fields (e.g. `=HYPERLINK(…)`) | Text starting with `= + - @` is stored as plain text |
| Huge inputs | Text is cut to 120 characters (stop rule: 500); numbers must be real numbers |
| Missing consent | Rows without the consent tick and a valid email or WhatsApp number are refused (checked on the server too) |
| A spam flood locking real visitors out | When the limit is hit, visitors still get their report; only the row is skipped |
| Formulas surviving a CSV/Excel export | Risky text is stored with a visible leading `'`, so it stays plain text in Excel too |
| Personal data in logs | Errors are logged by type only, never with the request body |

WhatsApp numbers are saved as `https://wa.me/…` links, so you can click straight into a chat. The script writes to a tab named **Leads**, and renames the first tab to that on first use.
