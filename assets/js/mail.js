(() => {
    console.log('🚀 mail.js - WORKING VERSION (reCAPTCHA optional)');
    
    const API_URL = "https://borkat-plumbing.vercel.app/send_email/v1/borkat-plumbing";
    // const API_URL = "http://127.0.0.1:4848/send_email/v1/borkat-plumbing";
    // const API_URL = "https://api.astraresults.com/send_email/v1/borkat-plumbing";
    const USE_RECAPTCHA = true; // Set to true when reCAPTCHA is working

    function pushToDataLayer(eventData) {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push(eventData);
        console.log('📊 GTM:', eventData.event);
    }

    function openUiModal(message) {
        const uiModal = document.querySelector("#uiModal");
        const uiModalMsg = document.querySelector("#uiModalMsg");
        if (!uiModal || !uiModalMsg) {
            alert(message);
            return;
        }
        uiModalMsg.textContent = message;
        uiModal.classList.add("is-open");
        uiModal.setAttribute("aria-hidden", "false");
    }

    function getRecaptchaToken(form) {
        if (!USE_RECAPTCHA) {
            console.log('⚠️ reCAPTCHA disabled');
            return { ok: true, token: "bypass_token" };
        }

        console.log('🔒 Checking reCAPTCHA...');
        const el = form.querySelector(".g-recaptcha");
        
        if (!el) return { ok: true, token: "" };

        if (typeof grecaptcha === "undefined") {
            return { ok: false, error: "reCAPTCHA still loading. Please wait." };
        }

        const widRaw = el.dataset.widgetId;
        const wid = widRaw ? Number(widRaw) : null;
        const token = Number.isFinite(wid) ? grecaptcha.getResponse(wid) : grecaptcha.getResponse();

        if (!token) {
            return { ok: false, error: "Please check the reCAPTCHA box." };
        }

        console.log('✅ reCAPTCHA OK');
        return { ok: true, token };
    }

    async function submitForm(form) {
        console.log('📝 SUBMITTING...');
        
        if (!form.checkValidity()) {
            form.reportValidity();
            return false;
        }
        console.log('✅ Validation passed');

        const rec = getRecaptchaToken(form);
        if (!rec.ok) {
            openUiModal(rec.error);
            pushToDataLayer({
                'event': 'form_validation_error',
                'formId': form.id,
                'errorType': 'recaptcha'
            });
            return false;
        }

        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            console.log('🔒 Button disabled');
        }

        const formData = new FormData(form);
        const params = new URLSearchParams();
        for (const [k, v] of formData.entries()) params.append(k, v);
        params.append("g-recaptcha-response", rec.token);

        pushToDataLayer({
            'event': 'form_submit_attempt',
            'formId': form.id,
            'formLocation': form.id === 'contactFormHero' ? 'hero' : 'footer'
        });

        try {
            console.log('🌐 Calling API...');
            
            const res = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: params.toString(),
            });

            console.log('📡 Status:', res.status);
            
            const data = await res.json().catch(() => null);
            console.log('📦 Data:', data);

            if (res.ok && data && data.success) {
                console.log('✅ SUCCESS! Redirecting...');
                
                pushToDataLayer({
                    'event': 'form_submit_success',
                    'formId': form.id,
                    'formLocation': form.id === 'contactFormHero' ? 'hero' : 'footer',
                    'conversionValue': 150
                });

                pushToDataLayer({
                    'event': 'conversion',
                    'conversionType': 'form_submission',
                    'conversionValue': 150
                });

                setTimeout(() => {
                    console.log('🎉 REDIRECT NOW');
                    window.location.href = "thank-you.html";
                }, 300);

            } else {
                console.log('❌ API ERROR');
                pushToDataLayer({
                    'event': 'form_submit_error',
                    'formId': form.id
                });
                
                setTimeout(() => {
                    window.location.href = "form-error.html";
                }, 300);
            }
        } catch (err) {
            console.error("💥 ERROR:", err);
            pushToDataLayer({
                'event': 'form_submit_error',
                'formId': form.id
            });
            
            setTimeout(() => {
                window.location.href = "form-error.html";
            }, 300);
        } finally {
            if (submitBtn) submitBtn.disabled = false;
        }
        
        return false;
    }

    document.addEventListener("DOMContentLoaded", () => {
        console.log('🎬 Starting...');
        
        const heroForm = document.getElementById("contactFormHero");
        const footerForm = document.getElementById("contactFormFooter");

        function setupForm(form) {
            if (!form) return;
            console.log('✅ Found:', form.id);
            
            // MAXIMUM PREVENTION - use ALL methods
            
            // Method 1: onsubmit
            form.onsubmit = function(e) {
                console.log('🛑 SUBMIT (onsubmit)');
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
                submitForm(form);
                return false;
            };
            
            // Method 2: addEventListener
            form.addEventListener("submit", function(e) {
                console.log('🛑 SUBMIT (listener)');
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                submitForm(form);
                return false;
            }, true);
            
            // Track form start
            const inputs = form.querySelectorAll('input, select, textarea');
            let started = false;
            inputs.forEach(input => {
                input.addEventListener('focus', () => {
                    if (!started) {
                        started = true;
                        pushToDataLayer({
                            'event': 'form_start',
                            'formId': form.id,
                            'formLocation': form.id === 'contactFormHero' ? 'hero' : 'footer'
                        });
                    }
                }, { once: true });
            });
        }

        setupForm(heroForm);
        setupForm(footerForm);
        
        // Track phone clicks
        document.querySelectorAll('a[href^="tel:"]').forEach(link => {
            link.addEventListener('click', () => {
                pushToDataLayer({
                    'event': 'phone_click',
                    'phoneNumber': link.href.replace('tel:', ''),
                    'clickLocation': link.closest('header') ? 'header' : 
                                   link.closest('.hero') ? 'hero' : 
                                   link.closest('footer') ? 'footer' : 'other'
                });
            });
        });
        
        console.log('✅ READY!');
    });
})();