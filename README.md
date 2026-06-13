# Watthour Solutions Website

Official website for **Watthour Solutions** — providing precision metering, CT meter testing, audits, field testing, billing corrections, revenue recovery, and professional training for Midwest electric cooperatives and utilities.

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

---

## Tech Stack

- **Pure HTML + CSS** (Tailwind via CDN)
- **Vanilla JavaScript** (mobile menu, minor interactions)
- **Web3Forms** – Contact and interest forms
- **GitHub Pages** – Hosting with custom domain (`watthoursolutions.com`)
- No build tools or frameworks required

---

## How to Make Updates

1. Edit the `.html` files directly in your code editor.
2. Update navigation links across pages when adding new content.
3. Commit and push changes to the `main` branch.
4. GitHub Pages will automatically deploy the updates.

**Forms:**  
All forms use Web3Forms with the existing access key. Manage form settings, recipient email, and notifications in the [Web3Forms dashboard](https://web3forms.com).

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
# Python 3
python3 -m http.server 8000
