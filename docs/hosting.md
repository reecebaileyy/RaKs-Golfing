# Putting the site online

This gets the waitlist landing page live on your own domain. The app runs on
**Vercel** and the sign-ups are stored in **Neon** (hosted Postgres). Both
deploy from GitHub with no GitHub Actions: every push to `main` goes live.

What only you can do (accounts, payment, DNS) is marked **You**. Everything
else is already in the repo.

## What it costs

| Service | Plan | Why |
| --- | --- | --- |
| Vercel | Pro, about $20 a month | Hosts the app. The free Hobby plan is for non-commercial projects only. |
| Neon | Free | Postgres for accounts, sign-ups and comments. A waitlist fits easily. |
| Resend | Free | Emails sign-in codes, including the one that makes you an admin. |
| Twilio | Pay per text, optional | Texted sign-in codes. US texting needs A2P 10DLC registration first, which takes days to weeks. |
| X, TikTok, Instagram | See [waitlist.md](waitlist.md#setting-up-the-social-logins) | Each social login is optional and turns on when its keys are set. |

## 1. Create the Vercel project (You)

1. Sign up at [vercel.com](https://vercel.com) with your GitHub account and
   pick the Pro plan.
2. **Add New → Project**, import `reecebaileyy/RaKs-Golfing`. Vercel detects
   Next.js; leave the build settings alone (the repo's `vercel.json` runs the
   database migrations before each build).
3. Don't deploy yet. Open the project's **Storage** tab, **Create Database**,
   pick **Neon**, region **US West (Oregon)** or whichever is closest to your
   golfers, and connect it to the project. This adds `DATABASE_URL` and
   `DATABASE_URL_UNPOOLED` to the project's settings for you.

   If you'd rather sign up at [neon.tech](https://neon.tech) directly, create a
   project there and paste its **pooled** connection string into
   `DATABASE_URL` and the **direct** one into `DATABASE_URL_UNPOOLED`.

   **Prisma Postgres** (also in the Storage tab) works too. It only adds
   `DATABASE_URL`, which is a direct connection, and the build uses it for the
   migrations when `DATABASE_URL_UNPOOLED` isn't set. Connect one database, not
   both.

## 2. Settings (You)

In **Settings → Environment Variables**, add these for **Production**:

| Name | Value |
| --- | --- |
| `SITE_MODE` | `waitlist` |
| `APP_URL` | `https://yourdomain.com` |
| `AUTH_SECRET` | 32+ random characters. Any password generator works, or run `openssl rand -base64 32`. |
| `ADMIN_EMAILS` | Your email, for the dashboard |
| `CONTACT_EMAIL` | The email people write to about their data |
| `RESEND_API_KEY`, `EMAIL_FROM` | From step 4 |

Add the social login keys when you have them; each button appears on its own
once its keys are set and you redeploy. The full list is in
[waitlist.md](waitlist.md#settings). Never set `OAUTH_MOCK` or
`LOGIN_CODE_ECHO` here.

Then **Deployments → Redeploy** (or push to `main`). The first build creates
the tables. The site is live at the `*.vercel.app` address Vercel shows.

## 3. Point your domain at it (You)

1. In the Vercel project, **Settings → Domains**, add `yourdomain.com` and
   `www.yourdomain.com`. Let Vercel redirect one to the other.
2. Vercel lists the DNS records to add. At your registrar (GoDaddy, Namecheap,
   Squarespace, Cloudflare...), open the domain's DNS settings and add exactly
   those. They usually look like:

   | Type | Name | Value |
   | --- | --- | --- |
   | A | `@` | `76.76.21.21` |
   | CNAME | `www` | `cname.vercel-dns.com` |

   Remove any older A or CNAME records on `@` or `www` that point at a parking
   page. On Cloudflare, set these records to **DNS only** (grey cloud).
3. Vercel checks the records and adds HTTPS by itself, usually within minutes,
   sometimes up to a day.

## 4. Email sign-in codes with Resend (You)

Waitlist accounts have no password, so they sign in with a code. Codes by email
need Resend.

1. Sign up at [resend.com](https://resend.com), **Domains → Add domain**, and
   enter `yourdomain.com`.
2. Add the DNS records Resend shows at your registrar (they're on a `send`
   subdomain and don't touch the website records), then click verify.
3. **API Keys → Create**, with sending access. Put it in `RESEND_API_KEY`, set
   `EMAIL_FROM` to `RaKs Golfing <hello@yourdomain.com>`, and redeploy.

## 5. Make yourself the admin

1. Join the waitlist on your live site with the email in `ADMIN_EMAILS` (skip
   this if you already joined with it).
2. Go to `/signin`, enter that email, and type the code from your inbox.
3. Open `https://yourdomain.com/admin/waitlist` for the dashboard and CSV.

## Changing the site later

- Every push to `main` redeploys. Preview deployments of other branches use the
  same settings, so in the Neon integration turn on **preview branches** (each
  preview gets its own copy of the database) or switch previews off.
- Changing `prisma/schema.prisma` needs a migration committed with it:
  `npx prisma migrate dev --name what-changed`. The deploy applies it.
- The rest of the app (booking, matches, wagers) stays closed while
  `SITE_MODE=waitlist`. Money matches stay off until the gaming lawyer review
  and a real payment processor are done.

## Railway instead of Vercel

If you'd rather keep the app and database in one place:

1. At [railway.com](https://railway.com), **New Project → Deploy from GitHub
   repo** and pick the repo, then **+ New → Database → PostgreSQL**.
2. On the app service, set `DATABASE_URL` and `DATABASE_URL_UNPOOLED` to
   `${{Postgres.DATABASE_URL}}`, plus the settings in step 2 above.
3. Set the pre-deploy command to `npx prisma migrate deploy`; the build and
   start commands (`npm run build`, `npm start`) are picked up from
   `package.json`.
4. **Settings → Networking → Custom Domain**, then add the CNAME record Railway
   shows at your registrar.
