(function () {
    'use strict';

    // All forms post to the site's /api/form relay (FormSubmit backend).
    var FORM_ENDPOINT = '/api/form';
    // Site problems only. Normal form mail still goes to the business inbox.
    var SITE_SUPPORT_EMAIL = 'support@watthoursolutions.com';

    function withSiteSupport(message) {
        if (message.indexOf(SITE_SUPPORT_EMAIL) !== -1) return message;
        return message + ' Having trouble with the site? Email ' + SITE_SUPPORT_EMAIL + '.';
    }

    function getEndpoint() {
        var wh = window.WH_FORMS || {};
        return wh.provider === 'formsubmit' ? FORM_ENDPOINT : null;
    }

    var MAX_RESUME_BYTES = 1 * 1024 * 1024;

    function getResumeInput(form) {
        return form.querySelector('input[type="file"][name="resume"], input[type="file"][name="attachment"]');
    }

    function resumeTooLarge(form) {
        var input = getResumeInput(form);
        return !!(input && input.files && input.files[0] && input.files[0].size > MAX_RESUME_BYTES);
    }

    function getTurnstileToken() {
        if (!window.turnstile || window.WH_FORMS.turnstileWidgetId == null) {
            return '';
        }
        return window.turnstile.getResponse(window.WH_FORMS.turnstileWidgetId) || '';
    }

    function resetTurnstile() {
        if (window.turnstile && window.WH_FORMS.turnstileWidgetId != null) {
            window.turnstile.reset(window.WH_FORMS.turnstileWidgetId);
        }
    }

    function initTurnstile() {
        var siteKey = window.WH_FORMS && window.WH_FORMS.turnstileSiteKey;
        if (!siteKey || siteKey.indexOf('YOUR_') === 0) return;

        var container = document.getElementById('turnstile-widget');
        if (!container) return;

        function renderWidget() {
            if (!window.turnstile) {
                window.setTimeout(renderWidget, 100);
                return;
            }
            window.WH_FORMS.turnstileWidgetId = window.turnstile.render('#turnstile-widget', {
                sitekey: siteKey,
                theme: 'dark',
                // Tokens expire after ~5 minutes; get a fresh one automatically.
                'expired-callback': resetTurnstile
            });
        }

        renderWidget();
    }

    function setSubmitting(button, isSubmitting, idleHtml) {
        if (!button) return;
        button.disabled = isSubmitting;
        if (isSubmitting) {
            button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending...';
        } else if (idleHtml) {
            button.innerHTML = idleHtml;
        }
    }

    function showError(errorEl, message) {
        if (!errorEl) return;
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }

    function hideError(errorEl) {
        if (errorEl) errorEl.classList.add('hidden');
    }

    function showSuccess(form, successEl) {
        if (successEl) {
            successEl.classList.remove('hidden');
            successEl.setAttribute('tabindex', '-1');
            successEl.focus({ preventScroll: true });
            successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        if (form) form.classList.add('hidden');
    }

    var lastFocused = null;

    function showModal(modalId) {
        var modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove('hidden');
        modal.classList.add('is-open');
        document.body.style.overflow = 'hidden';
        lastFocused = document.activeElement;
        var focusTarget = modal.querySelector('button, [href], input, select, textarea');
        if (focusTarget) focusTarget.focus();
    }

    window.closeWhModal = function (modalId) {
        var modal = document.getElementById(modalId);
        if (!modal) return;
        modal.classList.remove('is-open');
        modal.classList.add('hidden');
        document.body.style.overflow = '';
        if (lastFocused && typeof lastFocused.focus === 'function') {
            lastFocused.focus();
        }
        lastFocused = null;
    };

    function initModals() {
        document.querySelectorAll('[data-wh-modal]').forEach(function (modal) {
            modal.addEventListener('click', function (e) {
                if (e.target === modal) {
                    closeWhModal(modal.id);
                }
            });
        });

        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            document.querySelectorAll('[data-wh-modal].is-open').forEach(function (modal) {
                closeWhModal(modal.id);
            });
        });
    }

    function fieldValue(form, name) {
        var el = form.querySelector('[name="' + name + '"]');
        if (!el) return '';
        if (el.type === 'checkbox') return el.checked ? (el.value || 'Yes') : '';
        return el.value || '';
    }

    function applyFormSubmitMeta(target, subject) {
        target._subject = subject;
        target._template = 'table';
        target._captcha = 'false';
        return target;
    }

    function buildContactPayload(form) {
        var name = fieldValue(form, 'name');
        var email = fieldValue(form, 'email');
        var inquiry = fieldValue(form, 'inquiry_type') || 'General Inquiry';

        return applyFormSubmitMeta({
            form_type: 'contact',
            name: name,
            email: email,
            utility: fieldValue(form, 'utility') || 'Not provided',
            phone: fieldValue(form, 'phone') || 'Not provided',
            inquiry_type: inquiry,
            message: fieldValue(form, 'message'),
            _gotcha: ''
        }, 'Watthour Contact: ' + inquiry);
    }

    function buildTrainingPayload(form) {
        var name = fieldValue(form, 'name');
        var email = fieldValue(form, 'email');
        var notify = form.querySelector('[name="notify_me"]');
        var contact = form.querySelector('[name="contact_me"]');

        return applyFormSubmitMeta({
            form_type: 'training',
            utility: fieldValue(form, 'utility'),
            name: name,
            title: fieldValue(form, 'title') || 'Not provided',
            phone: fieldValue(form, 'phone') || 'Not provided',
            email: email,
            attendees: fieldValue(form, 'attendees') || 'Not specified',
            notify_me: notify && notify.checked ? notify.value : 'No',
            contact_me: contact && contact.checked ? contact.value : 'No',
            message: fieldValue(form, 'message') || 'None',
            _gotcha: ''
        }, '2027 Metering Bootcamp Interest \u2014 ' + (fieldValue(form, 'utility') || name));
    }

    function buildCareersFormData(form, turnstileToken) {
        var name = fieldValue(form, 'name');
        var data = new FormData(form);
        data.set('_subject', 'Careers Application: ' + name);
        data.set('_template', 'table');
        data.set('_captcha', 'false');
        data.set('_next', 'https://watthoursolutions.com/careers.html?applied=1#apply-section');
        data.set('form_type', 'careers');
        if (turnstileToken) {
            data.set('cf-turnstile-response', turnstileToken);
        }
        // FormSubmit expects the uploaded file under "attachment".
        var resume = getResumeInput(form);
        if (resume && resume.name !== 'attachment') {
            data.delete(resume.name);
            if (resume.files && resume.files[0]) {
                data.append('attachment', resume.files[0], resume.files[0].name);
            }
        }
        return data;
    }

    function submitMultipart(endpoint, formData) {
        return fetch(endpoint, {
            method: 'POST',
            headers: { Accept: 'application/json' },
            body: formData
        });
    }

    function submitJson(endpoint, payload, turnstileToken) {
        if (turnstileToken) {
            payload['cf-turnstile-response'] = turnstileToken;
        }

        return fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json'
            },
            body: JSON.stringify(payload)
        });
    }

    function parseSubmitResponse(response) {
        return response.text().then(function (text) {
            var data = null;
            try {
                data = text ? JSON.parse(text) : null;
            } catch (e) {
                data = null;
            }

            var ok = response.ok;
            if (data && (data.success === 'false' || data.success === false)) ok = false;
            if (data && (data.success === 'true' || data.success === true)) ok = true;

            if (!ok) {
                throw new Error((data && data.message) ? data.message : (text || 'Submit failed'));
            }
            return data || response;
        });
    }

    function friendlyError(err) {
        var msg = (err && err.message) ? String(err.message) : '';
        if (msg.indexOf('does not exist') !== -1) {
            return withSiteSupport('The form is not configured correctly yet. Please try again later.');
        }
        if (msg.indexOf('Activation') !== -1 || msg.indexOf('Activate Form') !== -1) {
            return withSiteSupport('The application inbox still needs a one-time email confirmation. Please try again in a few minutes.');
        }
        if (msg.indexOf('file uploads are not supported') !== -1) {
            return withSiteSupport('Resume upload is not available on this form yet. Please try again shortly.');
        }
        if (msg.indexOf('Turnstile') !== -1 || msg.indexOf('captcha') !== -1) {
            return withSiteSupport('Security check failed. Please complete the check and try again.');
        }
        if (msg.indexOf('Failed to fetch') !== -1 || msg.indexOf('NetworkError') !== -1) {
            return withSiteSupport('We could not reach the server. Please check your connection and try again.');
        }
        if (msg && msg.length < 220 && msg.indexOf('{') === -1 && msg.indexOf('<') === -1) {
            return withSiteSupport(msg);
        }
        return withSiteSupport('Something went wrong. Please try again in a moment.');
    }

    function showAppliedFromQuery() {
        if (window.location.search.indexOf('applied=1') === -1) return;
        var form = document.querySelector('form[data-wh-form="careers"]');
        if (!form) return;
        var successEl = document.getElementById(form.getAttribute('data-wh-success'));
        showSuccess(form, successEl);
        if (window.history && window.history.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);
        }
    }

    function initForm(form) {
        var formKey = form.getAttribute('data-wh-form');
        if (!formKey) return;

        var submitBtn = form.querySelector('button[type="submit"]');
        var idleHtml = submitBtn ? submitBtn.innerHTML : '';
        var errorEl = form.querySelector('[data-wh-form-error]');
        var successEl = document.getElementById(form.getAttribute('data-wh-success'));
        var modalId = form.getAttribute('data-wh-modal-target');
        var isCareers = formKey === 'careers';
        var needsTurnstile = !!(window.WH_FORMS && window.WH_FORMS.turnstileSiteKey && window.WH_FORMS.turnstileSiteKey.indexOf('YOUR_') !== 0);

        var resumeInput = getResumeInput(form);
        if (isCareers && resumeInput) {
            resumeInput.addEventListener('change', function () {
                if (resumeTooLarge(form)) {
                    showError(errorEl, 'Resume must be 1 MB or smaller. Please choose a smaller PDF, DOC, or DOCX file.');
                    resumeInput.value = '';
                } else {
                    hideError(errorEl);
                }
            });
        }

        form.addEventListener('submit', function (e) {
            e.preventDefault();

            var gotcha = form.querySelector('input[name="_gotcha"]');
            if (gotcha && gotcha.value) return;

            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            if (isCareers && resumeTooLarge(form)) {
                showError(errorEl, 'Resume must be 1 MB or smaller. Please choose a smaller PDF, DOC, or DOCX file.');
                return;
            }

            var turnstileToken = getTurnstileToken();
            if (needsTurnstile && !turnstileToken) {
                showError(errorEl, 'Please complete the security check below, then try again.');
                return;
            }

            hideError(errorEl);

            var endpoint = getEndpoint();
            if (!endpoint) {
                showError(errorEl, withSiteSupport('Form is not configured yet. Please check back soon.'));
                return;
            }

            setSubmitting(submitBtn, true, idleHtml);

            var request;
            if (isCareers) {
                request = submitMultipart(endpoint, buildCareersFormData(form, turnstileToken));
            } else {
                var payload = formKey === 'training'
                    ? buildTrainingPayload(form)
                    : buildContactPayload(form);
                request = submitJson(endpoint, payload, turnstileToken);
            }

            request
                .then(parseSubmitResponse)
                .then(function () {
                    form.reset();
                    resetTurnstile();
                    if (modalId) {
                        showModal(modalId);
                    } else {
                        showSuccess(form, successEl);
                    }
                })
                .catch(function (err) {
                    console.error('Form error:', err);
                    resetTurnstile();
                    showError(errorEl, friendlyError(err));
                })
                .finally(function () {
                    setSubmitting(submitBtn, false, idleHtml);
                });
        });
    }

    function init() {
        initModals();
        initTurnstile();
        showAppliedFromQuery();
        document.querySelectorAll('form[data-wh-form]').forEach(initForm);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
