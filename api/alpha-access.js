// Vercel Serverless Function to handle alpha access form submissions
// Sends email notification to lmprotcol@gmail.com

export default async function handler(req, res) {
  // Set CORS headers
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

    // Validate required fields
    if (!name || !email || !role) {
      return res.status(400).json({ ok: false, error: 'Name, email, and role are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ ok: false, error: 'Invalid email format' });
    }

    console.log('[Alpha Access] New application:', { name, email, role, message });

    // Send email notification using Resend (or similar service)
    // You'll need to set RESEND_API_KEY in your Vercel environment variables
    const RESEND_API_KEY = process.env.RESEND_API_KEY;
    const recipientEmail = 'lmprotocolcontact@gmail.com';

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
            from: 'LM Protocol <noreply@lmprotocol.xyz>',
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

        if (!emailResponse.ok) {
          const errorData = await emailResponse.text();
          console.error('[Alpha Access] Email send failed:', errorData);
          // Still return success to user, but log the error
        } else {
          console.log('[Alpha Access] Email sent successfully to', recipientEmail);
        }
      } catch (emailError) {
        console.error('[Alpha Access] Email error:', emailError);
        // Still return success to user, but log the error
      }
    } else {
      console.warn('[Alpha Access] RESEND_API_KEY not set, skipping email send');
      console.log('[Alpha Access] Application data:', { name, email, role, message });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('[Alpha Access] Error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
}
