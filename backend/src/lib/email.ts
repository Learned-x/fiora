import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM || 'Fiora <no-reply@tangifiori.com>';

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  await resend.emails.send({ from: FROM, to, subject, html, text });
}
