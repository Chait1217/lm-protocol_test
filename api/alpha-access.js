// Vercel Serverless: alpha access form → email via Resend
// Env: RESEND_API_KEY, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL
// FROM must be a verified domain or Resend sandbox (onboarding@resend.dev). Gmail cannot be used as FROM.

import { Resend } from "resend";

const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || "lmprotocolcontact@gmail.com";
// Resend cannot send FROM gmail.com (unverified). Force sandbox if FROM is Gmail.
const rawFrom = process.env.CONTACT_FROM_EMAIL || "onboarding@resend.dev";
const CONTACT_FROM_EMAIL = /@gmail\.com$/i.test(rawFrom.replace(/^[^<]*<([^>]+)>$/, "$1").trim()) ? "onboarding@resend.dev" : rawFrom;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { name, email, role, message } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ ok: false, error: "Name, email, and role are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email format" });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[Alpha Access] RESEND_API_KEY not set");
      return res.status(200).json({ ok: true });
    }

    const resend = new Resend(apiKey);
    const from = CONTACT_FROM_EMAIL.includes("<") ? CONTACT_FROM_EMAIL : `LM Protocol <${CONTACT_FROM_EMAIL}>`;

    const textBody = [
      "New Alpha Access Application",
      "",
      `Name: ${name}`,
      `Email: ${email}`,
      `Role: ${role}`,
      message ? `Message: ${message}` : null,
      "",
      `Submitted at: ${new Date().toISOString()}`,
    ]
      .filter(Boolean)
      .join("\n");

    const { error } = await resend.emails.send({
      from,
      to: [CONTACT_TO_EMAIL],
      subject: `New Alpha Access Application from ${name}`,
      text: textBody,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #00FF99;">New Alpha Access Application</h2>
          <div style="background: #1a1a1a; padding: 20px; border-radius: 8px;">
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            <p><strong>Role:</strong> ${role}</p>
            ${message ? `<p><strong>Message:</strong><br>${(message || "").replace(/\n/g, "<br>")}</p>` : ""}
          </div>
          <p style="color: #888; font-size: 12px;">Submitted at: ${new Date().toLocaleString()}</p>
        </div>
      `,
    });

    if (error) {
      console.error("[Alpha Access] Resend error:", error);
      return res.status(500).json({ ok: false, error: error.message || "Failed to send email" });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[Alpha Access]", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}
