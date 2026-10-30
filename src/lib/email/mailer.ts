import nodemailer, { type Transporter } from "nodemailer";
import { config } from "@/lib/config";

let transporter: Transporter | null = null;

/** SMTP transport – funguje s vlastním SMTP i s Gmail App Password (smtp.gmail.com:465). */
export function getTransporter(): Transporter {
  if (!config.email.user || !config.email.pass) {
    throw new Error("Chybí SMTP_USER / SMTP_PASS v .env");
  }
  transporter ??= nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: { user: config.email.user, pass: config.email.pass },
  });
  return transporter;
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Prostý text → jednoduché HTML (odstavce), aby e-mail vypadal jako ručně psaný. */
function toHtml(text: string) {
  return text
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("\n");
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  inReplyTo?: string | null;
  references?: string[];
}) {
  const body = config.email.footer ? `${opts.text}\n\n${config.email.footer}` : opts.text;
  const info = await getTransporter().sendMail({
    from: config.email.from,
    to: opts.to,
    subject: opts.subject,
    text: body,
    html: toHtml(body),
    inReplyTo: opts.inReplyTo ?? undefined,
    references: opts.references?.length ? opts.references : undefined,
  });
  return { messageId: info.messageId as string };
}

export async function verifySmtp() {
  await getTransporter().verify();
}
