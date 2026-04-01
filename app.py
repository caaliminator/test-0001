"""
ArborCentric Solutions — Flask Application
Serves the landing page and handles form submissions via SMTP.
Updated for Cloudflare Worker proxy setup.
"""

import os
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from html import escape

import requests
from flask import Flask, render_template, request, redirect, url_for, send_from_directory, make_response
from dotenv import load_dotenv

# ──────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────
load_dotenv()

app = Flask(
    __name__,
    static_folder="assets",
    static_url_path="/assets",
    template_folder="templates",
)

# Trust proxy headers from Cloudflare Worker
app.config["PREFERRED_URL_SCHEME"] = "https"

app.config.update(
    # SMTP
    SMTP_HOST=os.getenv("SMTP_HOST", "smtp.gmail.com"),
    SMTP_PORT=int(os.getenv("SMTP_PORT", "465")),
    SMTP_USER=os.getenv("SMTP_USER", ""),
    SMTP_PASS=os.getenv("SMTP_PASS", ""),

    # Recipients
    CONTACT_RECEIVER=os.getenv("CONTACT_RECEIVER", ""),
    CONTACT_CC=os.getenv("CONTACT_CC", ""),

    # reCAPTCHA v2
    RECAPTCHA_SECRET=os.getenv("RECAPTCHA_SECRET", ""),
    RECAPTCHA_SITE_KEY=os.getenv("RECAPTCHA_SITE_KEY", ""),
)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────
def verify_recaptcha(token: str) -> bool:
    """Verify Google reCAPTCHA v2 token server-side."""
    secret = app.config["RECAPTCHA_SECRET"]
    if not secret:
        logger.warning("RECAPTCHA_SECRET not set — skipping verification.")
        return True

    try:
        resp = requests.post(
            "https://www.google.com/recaptcha/api/siteverify",
            data={"secret": secret, "response": token},
            timeout=5,
        )
        result = resp.json()
        logger.info("reCAPTCHA result: %s", result)
        return result.get("success", False)
    except Exception as exc:
        logger.error("reCAPTCHA verification failed: %s", exc)
        return False


def send_email(name: str, address: str, email: str, phone: str, service: str) -> bool:
    """Send the lead notification email via SMTP SSL."""
    cfg = app.config

    if not cfg["SMTP_USER"] or not cfg["SMTP_PASS"]:
        logger.error("SMTP credentials not configured.")
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = f"New Request from {name}"
    msg["From"] = cfg["SMTP_USER"]
    msg["To"] = cfg["CONTACT_RECEIVER"] or cfg["SMTP_USER"]

    cc_list = [
        addr.strip()
        for addr in cfg["CONTACT_CC"].split(",")
        if addr.strip()
    ]
    if cc_list:
        msg["Cc"] = ", ".join(cc_list)

    all_recipients = [msg["To"]] + cc_list

    html_body = f"""\
    <h3>New Request Form Submission</h3>
    <p><strong>Full Name:</strong> {escape(name)}</p>
    <p><strong>Address:</strong> {escape(address)}</p>
    <p><strong>Email:</strong> {escape(email)}</p>
    <p><strong>Phone:</strong> {escape(phone)}</p>
    <p><strong>Service:</strong> {escape(service)}</p>
    """
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP_SSL(cfg["SMTP_HOST"], cfg["SMTP_PORT"], timeout=10) as server:
            server.login(cfg["SMTP_USER"], cfg["SMTP_PASS"])
            server.sendmail(cfg["SMTP_USER"], all_recipients, msg.as_string())
        logger.info("Email sent successfully to %s", all_recipients)
        return True
    except Exception as exc:
        logger.error("SMTP send failed: %s", exc)
        return False



# ──────────────────────────────────────────────
# SEO: robots.txt & sitemap.xml
# ──────────────────────────────────────────────
@app.route("/googlee2628bccbde2c230.html")
def google_verification():
    """Google Search Console site verification."""
    return send_from_directory(app.template_folder, "googlee2628bccbde2c230.html", mimetype="text/html")


@app.route("/robots.txt")
def robots():
    """Serve robots.txt from templates directory."""
    return send_from_directory(app.template_folder, "robots.txt", mimetype="text/plain")


@app.route("/sitemap.xml")
def sitemap():
    """Serve sitemap.xml from templates directory."""
    return send_from_directory(app.template_folder, "sitemap.xml", mimetype="application/xml")





# ──────────────────────────────────────────────
# Routes
# ──────────────────────────────────────────────



# ── Individual Service Pages ──
@app.route("/")
def tree_maintenance():
    """Tree maintenance service landing page."""
    return render_template("tree-maintenance.html")


@app.route("/tree-removal/")
def tree_removal():
    """Tree removal service landing page."""
    return render_template("tree-removal.html")


@app.route("/tree-pruning/")
def tree_pruning():
    """Tree pruning service landing page."""
    return render_template("tree-pruning.html")


@app.route("/arborist-consultation/")
def arborist_consultation():
    """Arborist consultation service landing page."""
    return render_template("arborist-consultation.html")


@app.route("/thank-you")
def thank_you():
    """Success page after form submission."""
    return render_template("thank-you.html")


@app.route("/form-error")
def form_error():
    """Error page for failed submissions."""
    return render_template("form-error.html")


@app.route("/submit-form", methods=["POST"])
def submit_form():
    """Handle contact form submission."""

    # 1. Verify reCAPTCHA
    recaptcha_token = request.form.get("g-recaptcha-response", "")
    if not verify_recaptcha(recaptcha_token):
        logger.warning("reCAPTCHA verification failed.")
        return redirect("/form-error")

    # 2. Extract & validate fields
    name = request.form.get("full_name", "").strip()
    address = request.form.get("address", "").strip()
    email = request.form.get("email", "").strip()
    phone = request.form.get("phone", "").strip()
    service = request.form.get("service", "").strip()

    if not all([name, address, email, phone, service]):
        logger.warning("Missing required form fields.")
        return redirect("/form-error")

    # 3. Send email
    if send_email(name, address, email, phone, service):
        return redirect("/thank-you")

    return redirect("/form-error")


# ──────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────
if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8080)