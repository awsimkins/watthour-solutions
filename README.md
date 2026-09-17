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
| **Email (notifications)** | `asimkins@watthoursolutions.com` (FormSubmit) |

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
- **Vanilla JavaScript** — mobile menu, form handling (`js/forms.js`)
- **FormSubmit** — all site forms
- **Cloudflare Turnstile** — spam protection on forms (business account widget `watthour-solutions`)
- **GitHub Pages** — hosting with custom domain via `CNAME`

No build step required.

---

## Forms (FormSubmit + Turnstile)

All form IDs live in `js/forms-config.js`. Contact, training (meter school), and careers share one Turnstile site key.

**Turnstile site key** (public, in `js/forms-config.js`): `0x4AAAAAAE6bVfFEsjSahtZF`  
**Turnstile secret key:** Cloudflare Turnstile dashboard only — never commit to the repo.

### Careers resume uploads

The careers form uses multipart file upload.

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

## Deferred / future work

See **[DEFERRED.md](DEFERRED.md)** for the full backlog (forms testing, bootcamp, careers, WSApp, and related projects).
