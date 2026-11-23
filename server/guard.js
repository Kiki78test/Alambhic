'use strict';
/* Garde-fou anti-contournement : détecte les coordonnées (téléphone, e-mail, liens, réseaux sociaux) dans un message,
   y compris déguisées (« 06-12-34-56-78 », « zéro six douze… », « jean arobase gmail point com », « j'suis sur insta »…).
   Repris d'Airmony. Dans Alamb'hic : contrôle des pseudos (insultes, coordonnées) ; servira au futur tchat. Module universel (Node / navigateur). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(); else root.YD_GUARD = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const NUM = { zero: 1, un: 1, une: 1, deux: 1, trois: 1, quatre: 1, cinq: 1, six: 1, sept: 1, huit: 1, neuf: 1, dix: 2, onze: 2, douze: 2, treize: 2, quatorze: 2, quinze: 2, seize: 2, vingt: 2, trente: 2, quarante: 2, cinquante: 2, soixante: 2, cent: 1,
    one: 1, two: 1, three: 1, four: 1, five: 1, seven: 1, eight: 1, nine: 1, ten: 2, eleven: 2, twelve: 2, thirty: 2, forty: 2, fifty: 2, sixty: 2, seventy: 2, eighty: 2, ninety: 2 };
  const SEP_WORDS = { tiret: 1, point: 1, virgule: 1, espace: 1, dash: 1, dot: 1, et: 1, puis: 1, plus: 1, slash: 1 };
  const SOC_SRC = '(?:whats?\\s?app|watsap|wa\\.me|telegram|telegramm|signal|snap(?:chat)?|insta(?:gram)?|facebook|fb|messenger|tik\\s?tok|discord|skype|viber|linkedin|twitter|paypal|lydia|revolut)';
  const SOCIAL = new RegExp(SOC_SRC);
  const SOC_POSS = new RegExp('\\b(?:mon|ma|my|sur mon|sur ma)\\s+(?:compte\\s+|profil\\s+|pseudo\\s+)?' + SOC_SRC + '|' + SOC_SRC + '\\s*(?:c\\s?est|:|=|->)\\s*@?[a-z0-9]*[._0-9][a-z0-9._]*');
  const INTENT = /(contacte|contactez|appelle|appelez|ecris|ecrivez|joins|joignez|ajoute|ajoutez|retrouve|retrouvez|chope|\b(?:dm|mp|sms|mail|mel|num|tel)\b|textote|numero|telephone|portable|coordonnees|whatsapp)/;
  const OFF = /(hors\s+(?:de\s+)?(?:la\s+)?(?:plateforme|appli|application|airmony|site)|en\s+dehors\s+(?:de\s+)?(?:la\s+)?(?:plateforme|appli|application|airmony|site)|sans\s+passer\s+par\s+(?:la\s+)?(?:plateforme|appli|application|airmony|le\s+site|les\s+frais|la\s+commission)|eviter\s+(?:les\s+)?(?:frais|commissions?)|en\s+direct\s+avec\s+moi|payer?\s+(?:en\s+)?(?:cash|especes|liquide|virement)|paiement\s+(?:en\s+)?(?:cash|especes|liquide))/;
  const PROVIDERS = ['gmail', 'googlemail', 'hotmail', 'yahoo', 'outlook', 'icloud', 'protonmail', 'proton.me', 'laposte', 'wanadoo', 'orange.fr', 'free.fr', 'sfr.fr', 'msn.com', 'aol.com'];
  const TLD = '(?:com|fr|net|org|io|me|ly|be|ch|ca|co|app|link|info|eu|de|uk|us|tv|gg)';

  /* propos injurieux, haineux ou harcelants (FR + EN), y compris déguisés (c0nn4rd, p.u.t.e, f*ck) ; mots entiers seulement */
  const ABUSE = ['connard', 'connasse', 'conasse', 'connards', 'salope', 'salopard', 'salaud', 'pute', 'putain de ta', 'enculé', 'encule', 'enculer', 'enfoire', 'enfoiré', 'batard', 'bâtard', 'fdp', 'ntm', 'nique ta', 'niquer ta', 'ta gueule', 'ferme ta gueule', 'fils de pute', 'pd', 'pédé', 'pede', 'tapette', 'gouine', 'negre', 'nègre', 'bougnoule', 'youpin', 'sale arabe', 'sale noir', 'sale juif', 'bicot', 'chintok', 'trisomique', 'abruti', 'débile mental', 'grosse vache', 'pétasse', 'petasse', 'garce', 'catin', 'trou du cul', 'sac à merde', 'va te faire', 'je vais te tuer', 'va crever', 'je vais te buter', 'suceuse', 'couilles', 'nichons', 'baiser ta', 'je te baise',
    'fuck', 'fucking', 'fucker', 'motherfucker', 'shit head', 'bitch', 'bitches', 'cunt', 'whore', 'slut', 'asshole', 'dickhead', 'pussy', 'bastard', 'retarded', 'faggot', 'fag', 'nigger', 'nigga', 'kike', 'spic', 'chink', 'tranny', 'kill yourself', 'kys', 'go die', 'suck my', 'stfu'];
  const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '€': 'e', '!': 'i' };
  function deleet(f) { return f.replace(/[013457@$€!]/g, (c) => LEET[c]).replace(/(\p{L})[.*_\-]+(?=\p{L})/gu, '$1').replace(/(\p{L})\1{2,}/gu, '$1$1'); }
  let ABUSE_RE = null;
  function abusive(f) {
    if (!ABUSE_RE) ABUSE_RE = new RegExp('(?:^|[^a-z])(?:' + ABUSE.map((w) => fold(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')).join('|') + ')(?=$|[^a-z])');
    const g = deleet(f), sp = g.replace(/\b(\p{L}) (?=\p{L}\b)/gu, '$1');   // « p u t e » → « pute »
    return ABUSE_RE.test(f) || ABUSE_RE.test(g) || ABUSE_RE.test(sp);
  }
  function fold(s) {
    s = String(s == null ? '' : s).replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 48)).replace(/[Ａ-Ｚａ-ｚ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* ancien navigateur */ }
    return s.toLowerCase().replace(/[​-‏⁠﻿]/g, '').replace(/[‐-―−]/g, '-').replace(/[①-⑨]/g, '').replace(/[“”«»]/g, '"').replace(/\s+/g, ' ');
  }
  // retire ce qui ressemble à des dates, heures, montants (faux positifs fréquents dans un échange de prestation)
  function stripBenign(s) {
    return s.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ').replace(/\b\d{1,2}[\/.]\d{1,2}[\/.](?:20)?\d{2}\b/g, (m, off, all) => (/[\d][.\-\/ ]?$/.test(all.slice(Math.max(0, off - 2), off)) || /^[.\-\/ ]?\d/.test(all.slice(off + m.length, off + m.length + 2))) ? m : ' ').replace(/\b\d{1,2}\s?[h:]\s?\d{0,2}\b/g, ' ')
      .replace(/\b\d[\d\s.,]*\s?(?:€|eur\b|euros?\b|\$|usd\b|invites?\b|personnes?\b|pers\b|km\b|min\b|minutes?\b|ans\b|titres?\b)/g, ' ');
  }
  function phoneRun(s) {   // plus longue suite de chiffres (ou de nombres écrits en lettres) séparés par des tirets/points/espaces…
    const toks = s.match(/\d+|[a-z]+|[^\sa-z\d]/g) || []; let cur = 0, best = 0, started = false, plusLead = false;
    const flush = () => { if (cur > best) best = cur; cur = 0; started = false; };
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (/^\d+$/.test(t)) { cur += t.length; started = true; }
      else if (NUM[t]) { cur += NUM[t]; started = true; }
      else if (t === 'o' && started) cur += 1;                       // « 06 O1 » : O pour zéro
      else if (/^[.\-_/()*,•·+x]$/.test(t) || SEP_WORDS[t]) { if (t === '+' && !started) plusLead = true; }
      else flush();
    }
    flush(); return { digits: best, plus: plusLead };
  }
  function check(text, history) {
    const raw = String(text == null ? '' : text); if (!raw.trim()) return { blocked: false };
    const f = fold(raw), sq = f.replace(/[^a-z0-9@.]/g, ''), sq2 = f.replace(/[^a-z0-9]/g, '');
    if (abusive(f)) return { blocked: true, reason: 'abuse' };
    // coordonnées bancaires (IBAN, numéro de carte) : jamais dans un message
    if (/\bfr\s?\d{2}(?:\s?[0-9a-z]{4}){5}/.test(f) || /\b[a-z]{2}\d{2}(?:\s?[0-9a-z]{4}){3,7}\b/.test(f) && /iban|rib|virement|bank|banque/.test(f)) return { blocked: true, reason: 'bank' };
    if (/\b(?:\d[ -]?){13,19}\b/.test(f.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '')) && /carte|card|cb|visa|mastercard|cvv|cvc|expir/.test(f)) return { blocked: true, reason: 'bank' };
    // pollution du tchat : même caractère répété, message en majuscules très long
    if (/(.)\1{14,}/.test(raw) || (raw.length > 90 && raw === raw.toUpperCase() && /[A-Z]{70,}/.test(raw.replace(/[^A-Z]/g, '')))) return { blocked: true, reason: 'spam' };
    // e-mail
    if (/[a-z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\{at\}|\barobase\b|\barobaz\b|\barrobase\b)\s*[a-z0-9-]+/.test(f) && (/\.\s*[a-z]{2,}/.test(f) || /(?:point|dot)\s*[a-z]{2,}/.test(f) || PROVIDERS.some((p) => sq.includes(p.replace('.', ''))))) return { blocked: true, reason: 'email' };
    if (/arobase|arrobase|arobaz|\(at\)|\[at\]/.test(sq2) || /\b[a-z0-9._-]+\s+at\s+[a-z0-9-]+\s+(?:dot|point)\s+[a-z]{2,}/.test(f)) return { blocked: true, reason: 'email' };
    if (PROVIDERS.some((p) => { const k = p.replace('.', ''); return sq2.includes(k) && /(arobase|at|@|point|dot|\.)/.test(f); }) && /(mail|arobase|@|point|dot|\.com|\.fr)/.test(f)) return { blocked: true, reason: 'email' };
    if (/[a-z0-9._%+-]+@[a-z0-9-]+/.test(f)) return { blocked: true, reason: 'email' };
    // liens
    if (/(?:https?:\/\/|www\.)/.test(f) || new RegExp('\\b[a-z0-9-]{2,}\\s?\\.\\s?' + TLD + '\\b').test(f) || new RegExp('[a-z0-9-]{2,}\\s?(?:point|dot)\\s?' + TLD + '\\b').test(f)) return { blocked: true, reason: 'link' };
    // réseaux sociaux + intention de contact
    const soc = SOCIAL.test(f) || SOCIAL.test(sq2);
    if (SOC_POSS.test(f)) return { blocked: true, reason: 'social' };
    if (soc && (INTENT.test(f) || /@[a-z0-9._]{2,}/.test(f) || /\d{4,}/.test(f))) return { blocked: true, reason: 'social' };
    if (/(?:^|\s)@[a-z0-9._]{3,}/.test(f)) return { blocked: true, reason: 'social' };
    if (OFF.test(f)) return { blocked: true, reason: 'offplatform' };
    // téléphone (y compris sur plusieurs messages récents)
    const cand = [stripBenign(f)]; if (history && history.length) cand.push(stripBenign(fold(history.slice(-3).concat([raw]).join(' '))));
    for (const c of cand) { const r = phoneRun(c); if (r.digits >= 9 || (r.plus && r.digits >= 8)) return { blocked: true, reason: 'phone' }; }
    return { blocked: false };
  }
  const MSG = { email: 'adresse e-mail', phone: 'numéro de téléphone', link: 'lien externe', social: 'identifiant de réseau social', offplatform: 'échange hors plateforme', bank: 'coordonnées bancaires' };
  const WHY = (r) => r === 'abuse' ? 'Message non envoyé : les propos injurieux, haineux ou harcelants ne sont pas acceptés sur Alamb’hic.'
    : r === 'spam' ? 'Message non envoyé : évitez les répétitions et les messages tout en majuscules.'
    : r === 'bank' ? 'Message non envoyé : ne partagez jamais d’IBAN ni de numéro de carte dans un message. '
    : 'Message non envoyé : les coordonnées (' + (MSG[r] || 'contact') + ') ne peuvent pas être partagées ici. ';
  const MASK = (r) => r === 'abuse' ? '⚠ Message masqué : propos inappropriés.' : r === 'spam' ? '⚠ Message masqué.' : '⚠ Message masqué : il contenait des coordonnées.';
  return { check, why: WHY, mask: (text) => { const g = check(text); return g.blocked ? MASK(g.reason) : text; }, fold, abusive: (t) => abusive(fold(t)) };
});
