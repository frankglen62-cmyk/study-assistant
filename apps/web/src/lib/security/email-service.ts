import { Resend } from 'resend';

const brevoApiKey = process.env.BREVO_API_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail =
  process.env.BREVO_FROM_EMAIL ??
  process.env.RESEND_FROM_EMAIL ??
  'Study Assistant <noreply@resend.dev>';

function getResendClient(): Resend | null {
  if (!resendApiKey) return null;
  return new Resend(resendApiKey);
}

async function sendWithBrevo(to: string, subject: string, html: string): Promise<void> {
  if (!brevoApiKey) {
    throw new Error('Brevo API key is not configured.');
  }

  const match = fromEmail.match(/^(.*?)<(.+)>$/);
  const sender = (() => {
    if (!match) {
      return { name: 'Study Assistant', email: fromEmail.trim() };
    }

    const [, rawName = 'Study Assistant', rawEmail = fromEmail] = match;
    return {
      name: rawName.trim().replace(/^"|"$/g, '') || 'Study Assistant',
      email: rawEmail.trim(),
    };
  })();

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': brevoApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
    cache: 'no-store',
  });

  if (!response.ok) {
    const details = await response.text();
    console.error('Failed to send OTP email via Brevo:', details);
    throw new Error('Unable to send verification email. Please try again.');
  }
}

function buildOtpEmailHtml(code: string, purpose: string): string {
  const purposeLabel =
    purpose === 'login_2fa'
      ? 'sign-in verification'
      : purpose === 'email_change_current'
        ? 'email change verification'
        : purpose === 'email_change_new'
          ? 'new email verification'
          : 'security verification';

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:40px auto;padding:32px;background:#111;border-radius:16px;border:1px solid rgba(255,255,255,0.08);">
    <div style="text-align:center;margin-bottom:24px;">
      <h1 style="color:#fff;font-size:20px;margin:0;">Study Assistant</h1>
      <p style="color:#888;font-size:14px;margin:8px 0 0;">Your ${purposeLabel} code</p>
    </div>
    <div style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.1);border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
      <p style="color:#888;font-size:12px;text-transform:uppercase;letter-spacing:2px;margin:0 0 12px;">Verification Code</p>
      <p style="color:#fff;font-size:36px;font-weight:700;letter-spacing:8px;margin:0;font-family:monospace;">${code}</p>
    </div>
    <p style="color:#888;font-size:13px;line-height:1.6;margin:0;">
      This code expires in <strong style="color:#fff;">5 minutes</strong>. If you didn't request this, you can safely ignore this email.
    </p>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;">
    <p style="color:#555;font-size:11px;margin:0;text-align:center;">
      Study Assistant · Admin-managed private retrieval
    </p>
  </div>
</body>
</html>`.trim();
}

export async function sendOtpEmail(to: string, code: string, purpose: string): Promise<void> {
  const subject =
    purpose === 'login_2fa'
      ? 'Your sign-in verification code'
      : purpose === 'email_change_current'
        ? 'Verify your email change request'
        : purpose === 'email_change_new'
        ? 'Verify your new email address'
        : 'Your security verification code';

  const html = buildOtpEmailHtml(code, purpose);

  if (brevoApiKey) {
    await sendWithBrevo(to, subject, html);
    return;
  }

  const client = getResendClient();

  if (!client) {
    // Dev mode fallback — log to console
    console.log('');
    console.log('══════════════════════════════════════════');
    console.log(`  OTP CODE for ${to}`);
    console.log(`  Purpose: ${purpose}`);
    console.log(`  Code: ${code}`);
    console.log('══════════════════════════════════════════');
    console.log('');
    return;
  }

  const { error } = await client.emails.send({
    from: fromEmail,
    to,
    subject,
    html,
  });

  if (error) {
    console.error('Failed to send OTP email:', error);
    throw new Error('Unable to send verification email. Please try again.');
  }
}
