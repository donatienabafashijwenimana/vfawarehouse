import nodemailer from 'npm:nodemailer@^9';

function escapeHtml(value: unknown) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!);
}

export async function sendOperationEmail(
  admin: any,
  { eventKey, to, subject, heading, message }: { eventKey: string; to: string; subject: string; heading: string; message: string },
) {
  const smtpLogin = Deno.env.get('BREVO_SMTP_LOGIN');
  const smtpKey = Deno.env.get('BREVO_SMTP_KEY');
  const from = Deno.env.get('EMAIL_FROM');
  if (!smtpLogin || !smtpKey || !from) throw new Error('Brevo SMTP email delivery is not configured.');

  const { error: reserveError } = await admin.from('email_notification_events').insert({ event_key: eventKey, recipient: to });
  if (reserveError?.code === '23505') return { duplicate: true };
  if (reserveError) throw reserveError;

  const safeHeading = escapeHtml(heading);
  const safeMessage = escapeHtml(message);
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      auth: { user: smtpLogin, pass: smtpKey },
    });
    const result = await transporter.sendMail({
      from,
      to,
      subject,
      text: `${heading}\n\n${message}`,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#1f2937"><h2>${safeHeading}</h2><p>${safeMessage}</p><p>VFA Greenhouse Seeds Hub Ltd</p></div>`,
    });
    const { error: updateError } = await admin.from('email_notification_events')
      .update({ sent_at: new Date().toISOString(), provider_id: result.messageId ?? result.response ?? null })
      .eq('event_key', eventKey);
    if (updateError) console.error('Email sent, but its delivery record could not be updated:', updateError.message);
    return { sent: true };
  } catch (error) {
    await admin.from('email_notification_events').delete().eq('event_key', eventKey);
    throw error;
  }
}
