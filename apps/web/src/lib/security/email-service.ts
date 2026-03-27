import { Resend } from 'resend';

const brevoApiKey = process.env.BREVO_API_KEY;
const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail =
  process.env.BREVO_FROM_EMAIL ??
  process.env.RESEND_FROM_EMAIL ??
  'Study Assistant <noreply@resend.dev>';

type BrevoSender = {
  name: string;
  email: string;
};

let brevoSenderCache:
  | {
      fetchedAt: number;
      senders: BrevoSender[];
    }
  | null = null;

function getResendClient(): Resend | null {
  if (!resendApiKey) {
    return null;
  }

  return new Resend(resendApiKey);
}

function parseSenderAddress(rawValue: string): BrevoSender {
  const match = rawValue.match(/^(.*?)<(.+)>$/);

  if (!match) {
    return {
      name: 'Study Assistant',
      email: rawValue.trim(),
    };
  }

  const [, , rawEmail = rawValue] = match;

  return {
    name: 'Study Assistant',
    email: rawEmail.trim(),
  };
}

async function listBrevoSenders(): Promise<BrevoSender[]> {
  const now = Date.now();

  if (brevoSenderCache && now - brevoSenderCache.fetchedAt < 10 * 60 * 1000) {
    return brevoSenderCache.senders;
  }

  if (!brevoApiKey) {
    return [];
  }

  const response = await fetch('https://api.brevo.com/v3/senders', {
    headers: {
      'api-key': brevoApiKey,
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    const details = await response.text();
    console.error('Failed to list Brevo senders:', details);
    return [];
  }

  const payload = (await response.json()) as {
    senders?: Array<{ name?: string; email?: string; active?: boolean }>;
  };

  const senders = (payload.senders ?? [])
    .filter((sender) => sender.active && sender.email)
    .map((sender) => ({
      name: sender.name?.trim() || 'Study Assistant',
      email: sender.email!.trim(),
    }));

  brevoSenderCache = {
    fetchedAt: now,
    senders,
  };

  return senders;
}

async function resolveBrevoSender(): Promise<BrevoSender> {
  const configuredSender = parseSenderAddress(fromEmail);
  const activeSenders = await listBrevoSenders();

  if (activeSenders.length === 0) {
    return configuredSender;
  }

  const exactMatch = activeSenders.find(
    (sender) => sender.email.toLowerCase() === configuredSender.email.toLowerCase(),
  );

  if (exactMatch) {
    return {
      name: 'Study Assistant',
      email: exactMatch.email,
    };
  }

  const fallbackSender = activeSenders[0]!;
  console.warn(
    `Configured Brevo sender "${configuredSender.email}" is not active. Falling back to "${fallbackSender.email}".`,
  );

  return {
    name: 'Study Assistant',
    email: fallbackSender.email,
  };
}

async function sendBrevoMessage(input: {
  sender: BrevoSender;
  to: string;
  subject: string;
  html: string;
}) {
  if (!brevoApiKey) {
    throw new Error('Brevo API key is not configured.');
  }

  const payload = {
    sender: input.sender,
    to: [{ email: input.to }],
    subject: input.subject,
    htmlContent: input.html,
  };

  console.log('[Brevo] Sending email:', {
    sender: input.sender,
    to: input.to,
    subject: input.subject,
    apiKeyPrefix: brevoApiKey.substring(0, 12) + '...',
  });

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': brevoApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    cache: 'no-store',
  });

  const responseText = await response.text();
  console.log('[Brevo] Response:', {
    status: response.status,
    statusText: response.statusText,
    body: responseText,
  });

  return { ok: response.ok, status: response.status, text: responseText };
}

function isInvalidBrevoSender(details: string) {
  const normalized = details.toLowerCase();
  return normalized.includes('sender') && (normalized.includes('invalid') || normalized.includes('not valid'));
}

async function sendWithBrevo(to: string, subject: string, html: string): Promise<void> {
  // Proactively resolve the verified active sender from Brevo instead of
  // relying on the configured BREVO_FROM_EMAIL which may not be verified.
  const sender = await resolveBrevoSender();
  console.log('[Brevo] Starting email send to:', to, 'with verified sender:', sender);

  const result = await sendBrevoMessage({
    sender,
    to,
    subject,
    html,
  });

  if (!result.ok) {
    console.error('[Brevo] Failed to send email:', result.text);
    throw new Error('Unable to send verification email. Please try again.');
  }

  console.log('[Brevo] Email sent successfully to:', to);
}

async function sendWithResend(to: string, subject: string, html: string): Promise<void> {
  const client = getResendClient();

  if (!client) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'OTP email delivery is not configured in production. Add BREVO_API_KEY or RESEND_API_KEY to Vercel environment variables.',
      );
    }

    console.log('');
    console.log('==========================================');
    console.log(`  EMAIL FALLBACK for ${to}`);
    console.log(`  Subject: ${subject}`);
    console.log(html);
    console.log('==========================================');
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
    console.error('Failed to send email via Resend:', error);
    throw new Error('Unable to send verification email. Please try again.');
  }
}

async function sendWithConfiguredProvider(to: string, subject: string, html: string): Promise<void> {
  if (brevoApiKey) {
    await sendWithBrevo(to, subject, html);
    return;
  }

  await sendWithResend(to, subject, html);
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
      This code expires in <strong style="color:#fff;">5 minutes</strong>. If you did not request this, you can safely ignore this email.
    </p>
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;">
    <p style="color:#555;font-size:11px;margin:0;text-align:center;">
      Study Assistant · Admin-managed private retrieval
    </p>
  </div>
</body>
</html>`.trim();
}

function buildOtpEmailSubject(purpose: string): string {
  const sentAtLabel = new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Manila',
  }).format(new Date());

  const prefix =
    purpose === 'login_2fa'
      ? 'Study Assistant sign-in code'
      : purpose === 'email_change_current'
        ? 'Study Assistant email change verification'
        : purpose === 'email_change_new'
          ? 'Study Assistant new email verification'
          : 'Study Assistant security verification';

  return `${prefix} • ${sentAtLabel}`;
}

function buildEmailChangeConfirmationHtml(currentEmail: string, newEmail: string, confirmUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0a0f1a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:540px;margin:40px auto;padding:32px;background:#111827;border-radius:24px;border:1px solid rgba(255,255,255,0.08);">
    <div style="text-align:center;margin-bottom:28px;">
      <h1 style="color:#f8fafc;font-size:28px;margin:0;">Confirm your email change</h1>
      <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:12px 0 0;">
        We received a request to update your Study Assistant sign-in email from
        <strong style="color:#ffffff;"> ${currentEmail} </strong>
        to
        <strong style="color:#ffffff;"> ${newEmail} </strong>.
      </p>
    </div>
    <div style="background:#0b1220;border:1px solid rgba(255,255,255,0.08);border-radius:18px;padding:24px;margin:24px 0;">
      <p style="margin:0;color:#94a3b8;font-size:14px;line-height:1.7;">
        Click the button below to approve this new sign-in email. If you did not request this change, you can safely ignore this message.
      </p>
      <div style="text-align:center;padding-top:24px;">
        <a href="${confirmUrl}" style="display:inline-block;padding:14px 34px;border-radius:999px;background:linear-gradient(135deg,#14b8a6,#0d9488);color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;box-shadow:0 12px 30px rgba(20,184,166,0.28);">
          Confirm changes
        </a>
      </div>
    </div>
    <p style="margin:0;color:#64748b;font-size:12px;line-height:1.7;">
      If the button does not work, copy and paste this link into your browser:<br />
      <span style="color:#2dd4bf;word-break:break-all;">${confirmUrl}</span>
    </p>
  </div>
</body>
</html>`.trim();
}

export async function sendOtpEmail(to: string, code: string, purpose: string): Promise<void> {
  const subject = buildOtpEmailSubject(purpose);
  const html = buildOtpEmailHtml(code, purpose);
  await sendWithConfiguredProvider(to, subject, html);
}

export async function sendEmailChangeConfirmationEmail(input: {
  currentEmail: string;
  newEmail: string;
  confirmUrl: string;
}): Promise<void> {
  const html = buildEmailChangeConfirmationHtml(input.currentEmail, input.newEmail, input.confirmUrl);
  await sendWithConfiguredProvider(input.newEmail, 'Confirm your new sign-in email', html);
}
