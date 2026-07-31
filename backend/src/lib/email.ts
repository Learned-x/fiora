import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM || 'Fiora <no-reply@tangifiori.com>';

export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  // Il SDK Resend non lancia mai un'eccezione sugli errori API: restituisce
  // { data, error }. Senza questo controllo un 403/422/ecc. passa per un invio
  // riuscito, il job BullMQ risulta "completed" e l'errore sparisce nel nulla.
  const { error } = await resend.emails.send({ from: FROM, to, subject, html, text });
  if (error) {
    throw new Error(`Resend: ${error.name} — ${error.message}`);
  }
}
