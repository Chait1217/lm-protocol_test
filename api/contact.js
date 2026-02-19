// Vercel Serverless: contact form → email via Resend
// Env: RESEND_API_KEY, CONTACT_TO_EMAIL, CONTACT_FROM_EMAIL (default lmprotocolcontact@gmail.com)

import { Resend } from "resend";

const CONTACT_TO_EMAIL = process.env.CONTACT_TO_EMAIL || "lmprotocolcontact@gmail.com";
const CONTACT_FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || "lmprotocolcontact@gmail.com";

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
    const { name, email, message, category } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ ok: false, error: "Name, email, and message are required" });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ ok: false, error: "Invalid email format" });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[Contact] RESEND_API_KEY not set");
      return res.status(200).json({ ok: true });
    }

    const resend = new Resend(apiKey);
    const from = CONTACT_FROM_EMAIL.includes("<") ? CONTACT_FROM_EMAIL : `LM Protocol <${CONTACT_FROM_EMAIL}>`;

    const { error } = await resend.emails.send({
      from,
      to: [CONTACT_TO_EMAIL],
      subject: `Contact form: ${category ? `[${category}] ` : ""}from ${name}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        category ? `Category: ${category}` : null,
        "",
        message,
      ]
        .filter(Boolean)
        .join("\n"),
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px;">
          <h2 style="color: #00FF99;">Contact form</h2>
          <div style="background: #1a1a1a; padding: 20px; border-radius: 8px;">
            <p><strong>Name:</strong> ${name}</p>
            <p><strong>Email:</strong> ${email}</p>
            ${category ? `<p><strong>Category:</strong> ${category}</p>` : ""}
            <p><strong>Message:</strong></p>
            <p>${(message || "").replace(/\n/g, "<br>")}</p>
          </div>
          <p style="color: #888; font-size: 12px;">${new Date().toISOString()}</p>
        </div>
      `,
    });

    if (error) {
      console.error("[Contact] Resend error:", error);
      return res.status(500).json({ ok: false, error: error.message || "Failed to send email" });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[Contact]", err);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}
