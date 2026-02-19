// Vercel Serverless Function: alpha access form → email to lmprotocolcontact@gmail.com
//
// Setup (required for emails to arrive):
// 1. In Vercel: Project → Settings → Environment Variables
//    - RESEND_API_KEY = your Resend API key (from resend.com)
// 2. In Resend: either verify your domain (e.g. lmprotocol.xyz) and send from noreply@yourdomain.com,
//    OR for testing use their sandbox "from" so delivery works without domain verification:
//    - Add env in Vercel: RESEND_FROM_EMAIL = "onboarding@resend.dev"
// 3. Redeploy the project after adding/changing env vars.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const { name, email, role, message } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ ok: false, error: 'Name, email, and role are required' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ ok: false, error: 'Invalid email format' });
    }

    console.log('[Alpha Access] New application:', { name, email, role, message });

    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const recipientEmail = 'lmprotocolcontact@gmail.com';
    // Use RESEND_FROM_EMAIL for sandbox (onboarding@resend.dev) or your verified domain address
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'LM Protocol <noreply@lmprotocol.xyz>';
    const fromAddress = fromEmail.includes('<') ? fromEmail : `LM Protocol <${fromEmail}>`;

    if (RESEND_API_KEY) {
      try {
        const emailBody = `
New Alpha Access Application

Name: ${name}
Email: ${email}
Role: ${role}
${message ? `Message: ${message}` : ''}

Submitted at: ${new Date().toISOString()}
        `.trim();

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [recipientEmail],
            subject: `New Alpha Access Application from ${name}`,
            text: emailBody,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #00FF99;">New Alpha Access Application</h2>
                <div style="background: #1a1a1a; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>Name:</strong> ${name}</p>
                  <p><strong>Email:</strong> ${email}</p>
                  <p><strong>Role:</strong> ${role}</p>
                  ${message ? `<p><strong>Message:</strong><br>${message.replace(/\n/g, '<br>')}</p>` : ''}
                </div>
                <p style="color: #888; font-size: 12px;">Submitted at: ${new Date().toLocaleString()}</p>
              </div>
            `,
          }),
        });

        const responseText = await emailResponse.text();
        if (!emailResponse.ok) {
          console.error('[Alpha Access] Resend API error:', emailResponse.status, responseText);
          // Common: 403 = domain not verified → set RESEND_FROM_EMAIL=onboarding@resend.dev and redeploy
        } else {
          console.log('[Alpha Access] Email sent successfully to', recipientEmail);
        }
      } catch (emailError) {
        console.error('[Alpha Access] Email send exception:', emailError);
      }
    } else {
      console.warn('[Alpha Access] RESEND_API_KEY not set in Vercel → no email sent. Add it in Project Settings → Environment Variables and redeploy.');
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[Alpha Access] Error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
