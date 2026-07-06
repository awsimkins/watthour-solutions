# Watthour Solutions Website

Official website for **Watthour Solutions** — precision metering, CT meter testing, audits, field testing, billing corrections, revenue recovery, and professional training for Midwest electric cooperatives and utilities.

**Live site:** [https://watthoursolutions.com](https://watthoursolutions.com)  
**Repository:** [github.com/awsimkins/watthour-solutions](https://github.com/awsimkins/watthour-solutions)

---

## Company

| | |
|---|---|
| **Founded by** | Anthony W. Simkins |
| **Experience** | 30+ years in electric metering and utility operations |
| **Service area** | Midwest utilities and electric cooperatives |
| **Contact** | [watthoursolutions.com/contact.html](https://watthoursolutions.com/contact.html) |
| **Email (notifications)** | `contact@watthoursolutions.com` (Formspark — not displayed on site) |

Previously **Innovative Electric Services**, rebranded in 2025–2026 as Watthour Solutions.

---

## Pages

| File | URL | Description |
|------|-----|-------------|
| `index.html` | `/` | Home — hero, promo video, services overview, training teaser, testimonials |
| `services.html` | `/services.html` | Meter audits, field testing, billing corrections, revenue recovery, CT expertise |
| `training.html` | `/training.html` | 2027 Metering Bootcamp details + interest form |
| `about.html` | `/about.html` | Company story, founder background, core values |
| `contact.html` | `/contact.html` | General inquiries and project contact form |
| `careers.html` | `/careers.html` | Seasonal Field Technician Assistant posting + application form |

---

## Tech stack

- **HTML + Tailwind CSS** (CDN)
- **Vanilla JavaScript** — mobile menu, Formspark form handling (`js/forms.js`)
- **Formspark** — all site forms
- **Cloudflare Turnstile** — spam protection on forms
- **GitHub Pages** — hosting with custom domain via `CNAME`

No build step required.

---

## Forms (Formspark + Turnstile)

All form IDs live in `js/forms-config.js`:

| Form | Config key | Formspark ID | Page |
|------|------------|--------------|------|
| Contact | `contact.formId` | `form_v1_XDr3rzLmlcH4XAciA5xiLMuC` | `contact.html` |
| 2027 Bootcamp interest | `training.formId` | `form_v1_skGpnkEJeUacRlevaT5BMMPX` | `training.html` |
| Careers application | `careers.formId` | `form_v1_qSDKbwiHcEha7g8qgONPBDIO` | `careers.html` |

**Turnstile site key** (public, in `js/forms-config.js`): `0x4AAAAAADrY__8JcwJg7-i9`  
**Turnstile secret key:** Formspark dashboard only — never commit to the repo.

### Notification emails (Formspark dashboard)

Set notification email to `contact@watthoursolutions.com` on each form.

### Careers resume uploads

The careers form uses multipart file upload. Ensure **file uploads are enabled** in that Formspark form's settings.

---

## Assets

| File | Purpose |
|------|---------|
| `logo.png` | Navbar logo and favicon |
| `watthour-ad.mp4` | Homepage promotional video (~11 MB) |
| `CNAME` | Custom domain: `watthoursolutions.com` |
| `js/forms-config.js` | Form IDs and Turnstile site key |
| `js/forms.js` | Shared form submit handler |

---

## Local development

```bash
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). Use a local server (not `file://`) so form scripts and assets load correctly.

---

## Deploy

1. Edit files locally.
2. Commit and push to `main`.
3. GitHub Pages deploys automatically to [watthoursolutions.com](https://watthoursolutions.com).

---

## GitHub repository settings

Recommended **description** (paste in repo Settings → General):

> Official website for Watthour Solutions — precision metering, CT testing, revenue recovery, and utility training for Midwest cooperatives.

**Website URL:** `https://watthoursolutions.com`

---

## Deferred / future work

See **[DEFERRED.md](DEFERRED.md)** for the full backlog (forms testing, bootcamp, careers, WSApp, and related projects).