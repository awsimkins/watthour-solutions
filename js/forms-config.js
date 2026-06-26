// Formspark + Cloudflare Turnstile (public site key only — secret stays in Formspark dashboard)
// Create three forms at https://formspark.io and paste each form ID below.
// Notification email: asimkins@watthoursolutions.com (set in each form's Formspark dashboard)
//
// Turnstile: add watthoursolutions.com to your widget's allowed hostnames in Cloudflare,
// or create a separate widget for this site.
window.WH_FORMS = {
    turnstileSiteKey: '0x4AAAAAADrY__8JcwJg7-i9',
    contact: {
        formId: 'form_v1_XDr3rzLmlcH4XAciA5xiLMuC'
    },
    training: {
        formId: 'YOUR_TRAINING_FORM_ID'
    },
    careers: {
        formId: 'YOUR_CAREERS_FORM_ID'
    }
};