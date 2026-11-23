"use strict";
/* Alamb'hic — e-mails transactionnels via Resend (même équipe Resend qu'Airmony et Hermaion).
   Variables Render : RESEND_API_KEY, MAIL_FROM (ex. « Alamb'hic <noreply@domaine-vérifié> »). Sans clé : le message est
   seulement journalisé, jamais envoyé. */
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const enabled = () => !!process.env.RESEND_API_KEY;

function layout(title, body, cta) {
  return `<!doctype html><html><body style="margin:0;background:#0a1626;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#eaf2ff">
<div style="max-width:520px;margin:0 auto;background:#10213a;border:1px solid #1f3a5f;border-radius:14px;padding:28px">
<div style="font-size:24px;font-weight:800">Alamb<span style="color:#2f8cff">'hic</span></div>
<h2 style="font-weight:600;margin:18px 0 10px">${esc(title)}</h2>
<div style="font-size:15px;line-height:1.55;color:#c7d6ee">${body}</div>
${cta ? `<p style="margin:24px 0"><a href="${esc(cta.url)}" style="background:#2f8cff;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;display:inline-block">${esc(cta.label)}</a></p><p style="font-size:12px;color:#8aa3c7;word-break:break-all">Si le bouton ne fonctionne pas, copiez ce lien : ${esc(cta.url)}</p>` : ""}
<p style="font-size:12px;color:#8aa3c7;margin-top:26px">Vous recevez cet e-mail car une action a été demandée sur votre compte Alamb'hic. Si ce n'est pas vous, ignorez-le.</p>
</div></body></html>`;
}

async function send({ to, subject, html }) {
  if (!enabled()) { console.log(`[mail non envoyé : RESEND_API_KEY absent] à ${to.replace(/(.).*@/, "$1…@")} — ${subject}`); return { sent: false }; }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM || "Alamb'hic <onboarding@resend.dev>", to: [to], subject, html }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) { console.error("[mail] Resend", r.status, (await r.text()).slice(0, 200)); return { sent: false }; }
    return { sent: true };
  } catch (e) { console.error("[mail]", e.message); return { sent: false }; }
}

const reset = url => ({ subject: "Nouveau mot de passe Alamb'hic", html: layout("Nouveau mot de passe",
  "<p>Vous avez demandé à changer votre mot de passe. Le lien est valable 1 heure et ne fonctionne qu'une fois.</p>", { url, label: "Choisir un nouveau mot de passe" }) });

module.exports = { send, reset, enabled };
