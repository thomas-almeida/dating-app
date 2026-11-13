import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type EmailMessage = { subject: string; text: string; html: string };

type EmailButton = { label: string; url: string };

function resendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  const replyTo = process.env.RESEND_REPLY_TO_EMAIL;
  return apiKey && from ? { apiKey, from, replyTo } : null;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>\'"]/g, (character) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[
      character
    ] ?? character,
  );
}

export async function sendEmail(to: string, message: EmailMessage) {
  const config = resendConfig();
  if (!config) return;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: config.from,
        to: [to],
        ...(config.replyTo ? { reply_to: config.replyTo } : {}),
        ...message,
      }),
    });
    if (!response.ok) console.error("sendEmail", response.status, await response.text());
  } catch (error) {
    console.error("sendEmail", error);
  }
}

export async function sendEmailToUser(userId: string, message: EmailMessage) {
  const config = resendConfig();
  if (!config) return;

  const { data, error } = await createAdminClient().auth.admin.getUserById(userId);
  if (error || !data.user.email) {
    if (error) console.error("sendEmailToUser", error);
    return;
  }
  await sendEmail(data.user.email, message);
}

export function emailParagraphs(paragraphs: string[]) {
  return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
}

export function emailLink(url: string, label: string) {
  return `<p><a href="${escapeHtml(url)}">${escapeHtml(label)}</a></p>`;
}

export function emailLayout({
  preheader,
  title,
  paragraphs,
  button,
}: {
  preheader: string;
  title: string;
  paragraphs: string[];
  button?: EmailButton;
}) {
  const content = paragraphs
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;color:#5e5558;font-size:16px;line-height:1.6;">${escapeHtml(paragraph)}</p>`,
    )
    .join("");
  const action = button
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 8px;"><tr><td style="border-radius:999px;background:#e96b7d;"><a href="${escapeHtml(button.url)}" style="display:inline-block;padding:14px 24px;border-radius:999px;color:#241c1e;font-size:15px;font-weight:700;text-decoration:none;">${escapeHtml(button.label)}</a></td></tr></table>`
    : "";

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body style="margin:0;background:#f5f1ef;font-family:Arial,Helvetica,sans-serif;color:#241c1e;"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(preheader)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5f1ef;padding:32px 12px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background:#ffffff;border-radius:24px;overflow:hidden;"><tr><td style="padding:28px 32px;background:#241c1e;"><div style="color:#f2e9e4;font-size:22px;font-weight:700;letter-spacing:-.3px;">Ágape</div></td></tr><tr><td style="padding:34px 32px 30px;"><h1 style="margin:0 0 22px;color:#241c1e;font-size:28px;line-height:1.2;letter-spacing:-.5px;">${escapeHtml(title)}</h1>${content}${action}</td></tr><tr><td style="padding:22px 32px;background:#faf8f7;border-top:1px solid #eee7e4;color:#867b7e;font-size:12px;line-height:1.5;">Este é um e-mail transacional do Ágape. Você o recebeu por ter uma conta ou cadastro no app.</td></tr></table><div style="max-width:560px;padding:18px 16px;color:#9a8f91;font-size:11px;line-height:1.5;">Ágape · conexões com calma e intenção</div></td></tr></table></body></html>`;
}
