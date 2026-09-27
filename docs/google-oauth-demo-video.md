# Google OAuth verification: demo video script and recording guide

**App:** Fat Tail Ads (Cloud project `fattailads-connect`, OAuth client "fattailads.com connect")
**Scopes being verified:** `analytics.manage.users`, `analytics.readonly`, `tagmanager.manage.users`, `tagmanager.readonly`
**Length target:** 3–5 minutes, one take, no narration needed. On-screen captions are optional.
**Where it goes:** YouTube, **Unlisted**. Paste the link into the verification form.

---

## What Google's reviewers check

The video must show all of the following:

1. **The app name and domain** the user is signing in to: fattailads.com, and a working link to the privacy policy.
2. **The full Google consent screen**, in English, with the **browser address bar visible**. Reviewers read the `client_id` in the URL to confirm it's this project's OAuth client, so the address bar must stay in frame the whole time.
3. **Every requested scope being used in the product.** For each scope, the video must show the feature it powers:
   - `analytics.readonly`: listing the client's GA4 accounts.
   - `analytics.manage.users`: adding Fat Tail Ads as a user.
   - `tagmanager.readonly`: listing GTM accounts and containers.
   - `tagmanager.manage.users`: inviting Fat Tail Ads.
4. **The result outside our app.** Show the new user in GA4 and GTM, so the reviewer sees the scope did exactly what was claimed and nothing more.

If the video or the form omits a scope, or shows one that isn't needed, Google sends the submission back. **Before submitting, the Data Access list will be trimmed to exactly these four** (plus `openid`/`email`); Claude handles that step. The Google Ads (`adwords`) and Merchant Center (`content`) scopes get verified later, once those features exist.

---

## Before you record (Claude can do 1–3; the rest is you)

1. **Reset the test state**, so the video shows a fresh grant instead of "already had access":
   - Remove austin@fattailads.com from the **Fat Tail Ads Google Account** in GA4 (Admin → Account access management).
   - Remove austin@fattailads.com from the **Fat Tail Ads** GTM account (Admin → User Management).
2. **Revoke the app from your gmail**, so Google shows the full consent screen again: myaccount.google.com/connections → fattailads.com → remove access. If a previous test succeeded, the app already revoked itself, so it may not be listed.
3. **Trim the Data Access scopes** to the four above.
4. **Clean browser window.** Use the Chrome profile where austin.lance.butler@gmail.com is signed in.
   - Open **one new window** with no other tabs.
   - Hide the bookmarks bar (⌘⇧B).
   - Close anything showing personal or client info.
   - Set the window to roughly 1440×900 and the zoom to 110% (⌘+) so text is readable in the video.
5. **Silence notifications:** turn on Do Not Disturb (Control Center → Focus).
6. **Have these URLs ready** to paste:
   - `https://fattailads.com/connect/beta/?test=1` (`?test=1` keeps the demo from recording a GA4 conversion)
   - `https://analytics.google.com` (to show the result)
   - `https://tagmanager.google.com` (to show the result)

---

## The script

Each scene lists what to click and an optional caption. You can add captions afterward, or skip them; they're nice-to-have.

**Scene 1: The app (≈20s)**
- Show `fattailads.com/connect/beta/?test=1`. Scroll slowly past the heading.
- Scroll to the footer and click **Privacy**. The privacy policy opens. Scroll to **§11 Google user data** and pause 3 seconds on the Limited Use paragraph. Go back.
- Caption: *"Fat Tail Ads' client-access tool at fattailads.com. Clients grant our team access to their Google Analytics and Tag Manager accounts without sharing a password."*

**Scene 2: Start a request (≈20s)**
- Fill in: Name "Demo Client", Company "Demo Co", Email "demo@fattailads.com". Leave **both** products ticked. Click **Continue**.
- The checklist shows Google Analytics 4 and Google Tag Manager. Pause on the yellow tip that says to tick both boxes on Google's screen.

**Scene 3: GA4 consent (≈40s). The most important scene; go slowly.**
- Click **Continue with Google** on the Google Analytics 4 row.
- Choose **austin.lance.butler@gmail.com**.
- On "Google hasn't verified this app", click **Continue**. This screen disappears after verification, and reviewers expect to see it in a test build.
- **On the consent screen, stop for 5 seconds.** Make sure the address bar (with `client_id=141676399380-…`) and the "fattailads.com wants access" heading are both visible.
- Tick **both** boxes, one at a time:
  - "Manage Google Analytics Account users by email address"
  - "See and download your Google Analytics data"
- Click **Continue**.
- Caption: *"We request only the two Analytics permissions needed: one to list your accounts, one to add our team as a user."*

**Scene 4: GA4 scopes in use (≈30s)**
- The account list appears. Pause 3 seconds.
- Caption: *"analytics.readonly: we list the GA4 accounts you can see, so you can choose one."*
- Select **Fat Tail Ads Google Account** and click **Grant access**.
- Wait for "Done — Fat Tail Ads now has Editor access…".
- Caption: *"analytics.manage.users: we add austin@fattailads.com as an Editor on the account you chose. Nothing else is read or changed, and your Google sign-in is discarded afterwards."*
- Click **Back to your checklist**. GA4 shows **Connected ✓**.

**Scene 5: GTM consent and scopes (≈50s)**
- Click **Continue with Google** on the Google Tag Manager row, choose the same gmail, and continue past the warning.
- **Consent screen: stop for 5 seconds with the address bar visible.** Tick both:
  - "Manage user permissions of your Google Tag Manager account and container"
  - "View your Google Tag Manager container and its subcomponents"
- Click **Continue**.
- The account list appears (caption: *"tagmanager.readonly: we list your Tag Manager accounts."*).
- Select **Fat Tail Ads** and click **Grant access**.
- Wait for "Done — Google sent Fat Tail Ads an invitation…".
- Caption: *"tagmanager.manage.users: we invite austin@fattailads.com as a User with publish rights on your containers."*
- Click **Back to your checklist**, then show the **All done** screen.

**Scene 6: Proof in Google's own tools (≈40s)**
- New tab: **analytics.google.com** → Admin (gear) → **Account access management** for "Fat Tail Ads Google Account". Point the cursor at the **austin@fattailads.com — Editor** row.
- New tab: **tagmanager.google.com** → the ⋮ menu on the **Fat Tail Ads** account → **User Management**. Point at **austin@fattailads.com — User, Invitation pending**.
- Caption: *"The only change made: our team was added as a user. Clients can remove us at any time here."*

**Scene 7: Access was not kept (≈15s)**
- New tab: **myaccount.google.com/connections**. Show that **fattailads.com is not listed**.
- Caption: *"We don't store your Google sign-in. The app's access is revoked as soon as the grant is complete."*
- Stop recording.

---

## How to record (macOS, no extra software)

**Recording: the built-in screen recorder**
1. Press **⌘⇧5**. The screenshot toolbar appears at the bottom of the screen.
2. Pick **Record Selected Portion** (the dotted-rectangle icon with a record dot). Drag the frame to cover exactly the Chrome window, including the address bar.
3. Click **Options**:
   - **Save to:** Desktop.
   - **Microphone:** None (no narration needed).
   - **Show Mouse Clicks:** ON. Reviewers can see what you click.
4. Click **Record**. A stop button (■) appears in the menu bar. Click it when done.
5. The file lands on your Desktop as `Screen Recording <date>.mov`.

**Tips for a clean take**
- Move the mouse slowly and pause on each important screen. A slow video beats a fast one here.
- If you make a mistake, keep going: pause, redo the step, and trim later. Don't restart unless the consent screen was cut off.
- A practice run first (without recording) makes the real take smooth. After a practice run, redo the reset steps (1–2) so the consent screen appears again.

**Trimming (optional): QuickTime**
- Open the `.mov` in **QuickTime Player** → **Edit → Trim (⌘T)** → drag the yellow handles → **Trim** → **File → Save**.
- Cutting dead time at the start and end is enough. Don't cut out the consent screens.

**Captions (optional)**
- Easiest: skip them in the video and put the scene captions above into the **YouTube description**, with timestamps.
- Or type them over the video in iMovie (Titles).

**Upload**
1. youtube.com → **Create → Upload video**, signed in as the account you want to own it (austin@fattailads.com is cleanest).
2. Title: "Fat Tail Ads – Google OAuth scopes demo (fattailads.com client access)".
3. Visibility: **Unlisted**. Not Private: reviewers can't open private videos.
4. Copy the link for the verification form.

---

## After recording

Send Claude the YouTube link. Claude then:
1. trims the Data Access scopes (if not already done),
2. fills the verification form (scope justifications and the video link), and stops at **Submit**, which is yours,
3. accepts the GTM invitation the demo created (the recording itself re-adds austin@fattailads.com to both accounts).
