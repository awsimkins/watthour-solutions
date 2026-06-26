# Watthour Solutions Website

Official website for **Watthour Solutions** — precision metering, CT meter testing, audits, field testing, billing corrections, revenue recovery, and professional training for Midwest electric cooperatives and utilities.

**Live Site:** [https://watthoursolutions.com](https://watthoursolutions.com)

---

## Pages

| File              | Description                              |
|-------------------|------------------------------------------|
| `index.html`      | Home page with hero, video, services overview, and training teaser |
| `services.html`   | Detailed services (Meter Audits, Field Testing, Billing Corrections, Revenue Recovery + CT focus) |
| `training.html`   | Training hub + 2027 Metering Bootcamp interest form |
| `about.html`      | Company story, founder background, and core values |
| `contact.html`    | Contact form and inquiry options |
| `careers.html`    | Seasonal Field Technician Assistant posting + application form |

---

## Tech Stack

- **Pure HTML + CSS** (Tailwind via CDN)
- **Vanilla JavaScript** (mobile menu, form handling)
- **Formspark** — Contact, training interest, and careers application forms
- **Cloudflare Turnstile** — Spam protection on forms (optional but recommended)
- **GitHub Pages** — Hosting with custom domain (`watthoursolutions.com`)
- No build tools or frameworks required

---

## Form Setup (Formspark)

Create **three forms** at [formspark.io](https://formspark.io) and paste each form ID into `js/forms-config.js`:

| Form | Config key | Page |
|------|------------|------|
| Contact inquiries | `contact.formId` | `contact.html` |
| 2027 Bootcamp interest | `training.formId` | `training.html` |
| Careers applications | `careers.formId` | `careers.html` |

Set notification email to **asimkins@watthoursolutions.com** in each form's Formspark dashboard.

**Turnstile:** Add `watthoursolutions.com` to your Cloudflare Turnstile widget's allowed hostnames, then paste the site key in `js/forms-config.js`. Add the Turnstile **secret key** only in the Formspark dashboard (per form).

**Careers resume uploads:** Formspark accepts file attachments via multipart upload. Enable file uploads in the careers form settings if prompted.

---

## How to Make Updates

1. Edit the `.html` files directly in your code editor.
2. Update navigation links across pages when adding new content.
3. Commit and push changes to the `main` branch.
4. GitHub Pages will automatically deploy the updates.

**Assets:**
- `logo.png` — Company logo (used in navbar and favicon)
- `watthour-ad.mp4` — Promotional video (currently on home page)

---

## Local Development

You can preview changes in two ways:

**Option 1 (Simplest):**  
Just open any `.html` file directly in your browser.

**Option 2 (Recommended):**  
Use a local server so links and assets work correctly:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`