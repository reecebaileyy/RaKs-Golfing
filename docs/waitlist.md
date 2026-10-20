# The waitlist

Before launch, the site runs as a landing page that collects sign-ups so we can
measure real demand. Every sign-up is a real account, tied to the login the
golfer picked, so on launch day they sign in the same way and their account is
already there.

To put it online, follow [hosting.md](hosting.md).

## What a golfer sees

`/` (in waitlist mode) or `/waitlist` (always):

1. **Join**: X, TikTok or Instagram buttons, or email or phone. Name and an
   email **or** phone number are required; ZIP code and how often they play
   are optional. A social sign-up asks for the email or phone on the next
   screen (`/join/finish`), because every account needs one of the two.
2. **Their spot**: "You're #12 on the list", how many friends joined with
   their invite link, the link to share, and buttons to connect other logins.
3. **Golf talk**: a public wall of short golf takes. Only signed-up golfers can
   post (280 characters, no links, 3 posts per 10 minutes, 10 a day). Admins
   can hide posts.

Sign-in at `/signin` offers the social buttons, a one-time code by email or
text, or a password (demo accounts only; waitlist accounts have no password).

## Accounts

| Field | Rule |
| --- | --- |
| `User.email`, `User.phone` | At least one is required. Phones are stored as E.164 (`+17145551234`); a bare 10 digit number is read as US. Both are unique. |
| `User.passwordHash` | Empty for waitlist accounts. |
| `User.emailVerifiedAt`, `phoneVerifiedAt` | Set the first time the golfer signs in with a code sent there. Sign-up doesn't verify, so it stays one step. |
| `OAuthAccount` | One row per connected X, TikTok or Instagram account (`provider` + the provider's account id). |
| `WaitlistEntry` | How they signed up, ZIP, rounds a month, their referral code, who referred them, and the UTM source, medium and campaign. |
| `LoginCode` | One-time codes, stored hashed: 6 digits, 10 minutes, 5 guesses, 5 codes an hour. |
| `GolfComment` | Posts on the wall, with `hidden` for moderation. |

Safety rules worth knowing:

- Joining with an email or phone that already has an account is refused with
  "already on the list, sign in". It never signs anyone in, so nobody can take
  over an account by typing someone else's email.
- A social account can only be connected to an existing account while signed
  in to it ("Connect X" on the spot card), for the same reason.
- `ADMIN_EMAILS` makes an account an admin only after it signs in with a code
  sent to that email.

## Measuring demand

`/admin/waitlist` (admins only) shows total sign-ups, today, the last 7 days, a
30 day chart, sign-ups by login, by source, by how often they play, top ZIP
codes, and the comment moderation list. **Download CSV** exports everyone for a
spreadsheet or an email tool.

Tag every link you post so the dashboard can tell channels apart:

```
https://yourdomain.com/?utm_source=tiktok&utm_campaign=launch-video
https://yourdomain.com/?utm_source=instagram&utm_medium=bio
```

The first tagged visit is remembered for 30 days. Invite links look like
`https://yourdomain.com/?ref=K7M2Q9X` and count toward the person who shared
them; untagged sign-ups from an invite show as "referral".

## Settings

| Variable | What it does |
| --- | --- |
| `SITE_MODE=waitlist` | `/` shows the landing page and the rest of the app is closed (pages redirect to `/`, APIs return 404). Sign-in, `/join`, `/admin`, `/privacy` and `/terms` stay open. Leave it unset to run the full app; the waitlist is still at `/waitlist`. |
| `APP_URL` | The public address, like `https://yourdomain.com`. Used for invite links and social login callbacks. |
| `AUTH_SECRET` | 32+ random characters. Signs the cookies used during social sign-in. Required in production for social logins. |
| `ADMIN_EMAILS` | Comma-separated emails that become admins after signing in with a code. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Email sign-in codes through [Resend](https://resend.com). `EMAIL_FROM` like `RaKs Golfing <hello@yourdomain.com>`. |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | Texted sign-in codes through Twilio. Without them, phone sign-ups still work but can't sign in by text yet. |
| `X_CLIENT_ID`, `X_CLIENT_SECRET` | Turns on "Continue with X". |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | Turns on "Continue with TikTok". |
| `INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET` | Turns on "Continue with Instagram". |
| `WAITLIST_TIME_ZONE` | Time zone for the dashboard's daily counts. Default `America/Los_Angeles`. |
| `CONTACT_EMAIL` | Shown on the privacy and terms pages for deletion requests. |

A social button only shows up once both of its keys are set.

**Test switches, never in production:** `OAUTH_MOCK=1` replaces all three
social logins with a local stand-in consent page, and `LOGIN_CODE_ECHO=1` shows
sign-in codes on screen instead of sending them. With either on, anyone could
sign in as anyone. The end-to-end tests use both.

## Setting up the social logins

Each one is an app you register with the platform. They all ask for the same
things, so have these ready: the site address, the privacy page
(`https://yourdomain.com/privacy`), the terms page
(`https://yourdomain.com/terms`), an app icon, and the callback address:

```
https://yourdomain.com/api/auth/oauth/x/callback
https://yourdomain.com/api/auth/oauth/tiktok/callback
https://yourdomain.com/api/auth/oauth/instagram/callback
```

### X

1. Sign up at [developer.x.com](https://developer.x.com) and create a project
   and app.
2. In the app's **User authentication settings**, turn on OAuth 2.0, pick
   **Web App** (a confidential client), add the callback address and website.
3. Copy the OAuth 2.0 **Client ID** and **Client Secret** into `X_CLIENT_ID`
   and `X_CLIENT_SECRET`.

Cost: X closed its free API tier to new developers in 2026. New apps pay per
use, and each X sign-in reads the golfer's profile once (about $0.01 each at
the published rate), so you'll need to add a few dollars of credit.

### TikTok

1. Sign up at [developers.tiktok.com](https://developers.tiktok.com), open
   **Manage apps** and connect a new app (under an organization if you can).
2. Fill in the app details (icon, name, category, description, terms and
   privacy links), pick the **Web** platform with the site address, add the
   **Login Kit** product and its callback address. The scope we use is
   `user.info.basic` (display name and avatar).
3. Copy the **Client key** and **Client secret** into `TIKTOK_CLIENT_KEY` and
   `TIKTOK_CLIENT_SECRET`, then **Submit for review**. Until TikTok approves it,
   only sandbox test users can sign in.

### Instagram

Instagram only offers login for **professional accounts** (business or
creator). The API that let personal accounts log in (Basic Display) was shut
down in December 2024, so golfers with personal Instagram accounts can't sign
in with it as they are and should pick another option.

1. At [developers.facebook.com](https://developers.facebook.com) create an app
   and add the **Instagram** product, using "API setup with Instagram login".
2. Under **Business login settings** add the callback address.
3. Copy the **Instagram app ID** and **Instagram app secret** (not the Facebook
   app ones) into `INSTAGRAM_CLIENT_ID` and `INSTAGRAM_CLIENT_SECRET`.
4. Request advanced access to `instagram_business_basic` in App Review. Meta
   asks for business verification and a short screen recording of the login.

Given the business-account limit, it's reasonable to launch with X, TikTok,
email and phone and add Instagram later.

## On launch day

Remove `SITE_MODE` (or set it to anything else) and redeploy. Everyone on the
list signs in with the login they joined with. Golfers without an email are
asked for one at checkout, since course confirmations and receipts go by email.
