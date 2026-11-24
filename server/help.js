"use strict";
/* Alamb'hic — aide : base de questions et réponses (seule source de l'assistant).
   Sans clé IA : la réponse la plus proche est renvoyée telle quelle. Avec ANTHROPIC_API_KEY (et ANTHROPIC_MODEL, facultatif),
   l'IA reformule à partir de cette base uniquement. Tenir à jour quand l'appli change (noms de boutons, seuils). */
const KB = [
  { id: "calcul", k: ["calcul", "calcule", "formule", "widmark", "watson", "taux", "estime", "estimation", "fiable", "precis", "precision"],
    q: "Comment mon taux est-il calculé ?",
    a: "Alamb'hic utilise la formule de Widmark avec l'eau corporelle de Watson (sexe, âge, taille, poids). L'alcool passe dans le sang pendant 30 à 90 minutes selon le repas, puis le corps en élimine environ 0,15 g/L par heure. C'est une estimation : l'écart avec un éthylotest peut dépasser 0,2 g/L. Ce n'est jamais une autorisation de conduire." },
  { id: "repas", k: ["repas", "manger", "mange", "diner", "dejeuner", "pic", "baisse", "ventre", "jeun", "absorption"],
    q: "Pourquoi mon pic baisse-t-il après un repas ?",
    a: "Un repas ralentit le passage de l'alcool dans le sang : à jeun il passe en 30 min, après un gros repas en 90 min, et une partie est éliminée en route. Le pic est donc plus bas et plus tardif. Notez vos repas avec leur heure (avant le premier verre, ou dans « Mes repas »)." },
  { id: "plafond", k: ["plafond", "limite", "hors plafond", "perso", "personnel"],
    q: "À quoi sert le plafond perso ?",
    a: "C'est la limite que vous vous fixez (0,5 à 1 g/L, 0,8 conseillé). La dépasser donne le titre de honte « Hors plafond » (−15 points). Il ne change pas l'avatar, qui suit les mêmes seuils pour tout le monde." },
  { id: "titres", k: ["titre", "titres", "points", "score", "honte", "trophee", "classement", "chameau", "fusee", "naufrage"],
    q: "Comment marchent les titres et les points ?",
    a: "Chaque titre se gagne une fois par soirée. Trophée : +10 (Premières bulles, Joues roses, Philosophe de comptoir, Atterrissage en douceur, Retour sur Terre, le Chameau, l'Oasis, Sam). Honte : −15 (Hors plafond, la Fusée, le Naufragé). Les alertes ne rapportent rien : elles servent à veiller les uns sur les autres." },
  { id: "badges", k: ["badge", "badges", "bronze", "argent", "or", "palier", "paliers", "long terme"],
    q: "Que sont les badges bronze, argent et or ?",
    a: "Les badges suivent votre historique, soirée après soirée : l'Habitué (soirées jouées), le Chameau d'or (verres d'eau), Sam fidèle, Sans fausse note (soirées sans honte), Pilote de ligne (atterrissages en douceur), Bande de potes (amis). Ils sont dans votre profil, avec le nombre qui manque pour le palier suivant." },
  { id: "avatar", k: ["avatar", "personnage", "stade", "stades", "cercle", "bonhomme"],
    q: "Comment évolue l'avatar ?",
    a: "Il passe par 10 stades, du sourire (0) au KO (1,5 g/L), avec les mêmes seuils pour tous. Il tient son verre 25 min après chaque verre, boit de l'eau quand le taux redescend, et sursaute en annonçant chaque nouveau stade." },
  { id: "sam", k: ["sam", "conducteur", "conduire", "voiture", "volant", "ramener"],
    q: "Comment devenir Sam ?",
    a: "Sur l'écran Moi, cochez « Je suis Sam ce soir » avant tout verre d'alcool. Vous ne pourrez noter que des boissons sans alcool, et vous gagnez le trophée Sam. Rappel : après avoir bu, même un peu, on ne prend pas le volant." },
  { id: "supprimer", k: ["supprimer", "annuler", "erreur", "trompe", "efface", "retirer", "verre en trop"],
    q: "Je me suis trompé de verre",
    a: "Juste après l'ajout, touchez « Annuler » dans le bandeau (pendant 1 minute, sans trace). Ensuite, la croix dans « Mes verres » supprime le verre pendant 3 h ; la suppression est visible dans le fil de la soirée." },
  { id: "soiree", k: ["soiree", "code", "rejoindre", "creer", "inviter", "invitation", "debut", "fin"],
    q: "Comment créer ou rejoindre une soirée ?",
    a: "Onglet Soirées : donnez un nom, le début et la fin prévus, puis « Créer la soirée ». Partagez le code de 4 lettres (« Copier l'invitation ») ; vos amis le saisissent dans « Rejoindre avec un code ». La courbe va du début à la fin prévus ; vos verres notés pendant la soirée s'y rattachent tout seuls." },
  { id: "sessions", k: ["session", "sessions", "courbe", "historique", "large", "hier", "retour a 0"],
    q: "Qu'est-ce qu'une session ?",
    a: "Une session va de votre premier verre d'alcool jusqu'au retour à 0 g/L. Alamb'hic les découpe tout seul ; l'onglet Soirées (rubrique Historique) les liste sur 60 jours, avec les soirées à code, avec pour chacune sa propre courbe, son pic et ses verres." },
  { id: "agenda", k: ["agenda", "calendrier", "couleur", "vert", "orange", "rouge", "mois", "trop", "abus"],
    q: "Que veulent dire les couleurs de l'agenda ?",
    a: "Chaque jour est coloré selon vos verres standard : vert de 1 à 2, orange de 3 à 5, rouge à 6 et plus. Une carte vous prévient avec bienveillance au-delà de 10 verres sur 7 jours ou d'un jour à 6 et plus. Pour en parler : Alcool info service, 0 980 980 930 (7 j/7, 8 h-2 h)." },
  { id: "groupes", k: ["groupe", "groupes", "potes", "bande", "48", "partager mes courbes"],
    q: "Comment marchent les groupes de potes ?",
    a: "Onglet Groupes : créez un groupe et partagez son lien ou son code de 6 caractères. Les membres voient les courbes de tous, où que chacun boive, par créneaux de 48 h. Quitter le groupe arrête le partage." },
  { id: "amis", k: ["ami", "amis", "code ami", "ajouter", "partage", "partager mon taux"],
    q: "Comment ajouter des amis ?",
    a: "Bouton « Amis » en haut : partagez votre lien ou donnez votre code ami (6 caractères). Une fois la demande acceptée, vous voyez leur taux en direct pendant leurs soirées. Vous pouvez couper ce partage à tout moment." },
  { id: "notifs", k: ["notification", "notifications", "push", "alerte", "prevenir", "son", "vibre"],
    q: "Comment recevoir les notifications ?",
    a: "Profil → Notifications → « Activer sur cet appareil », puis choisissez ce que vous voulez recevoir : alertes, titres de la soirée, titres des amis, rappel repas, badges. Sur iPhone, installez d'abord l'appli sur l'écran d'accueil (Partager → Sur l'écran d'accueil)." },
  { id: "tv", k: ["tv", "tele", "television", "ecran", "grand ecran", "projeter", "bar", "telecommande"],
    q: "Comment afficher la soirée sur une TV ?",
    a: "Écran Moi → « Écran TV » : un code de 6 caractères s'affiche. Sur la TV (ou un ordinateur relié), ouvrez alambhic.onrender.com/tv et saisissez-le. Votre téléphone sert de télécommande : vue automatique, avatars, courbes ou fil." },
  { id: "recap", k: ["recap", "recapitulatif", "partager la soiree", "souvenir", "lien public", "reseaux"],
    q: "Comment partager le récapitulatif de la soirée ?",
    a: "Écran Moi → « Récap à partager » crée un lien public avec les courbes, les avatars et les titres. Seuls les joueurs qui ont coché « Apparaître dans le récap » y figurent, avec leur pseudo uniquement. Le lien peut être supprimé à tout moment." },
  { id: "motdepasse", k: ["mot de passe", "oublie", "connexion", "connecter", "compte", "reinitialiser"],
    q: "J'ai oublié mon mot de passe",
    a: "Sur l'écran de connexion, touchez « Mot de passe oublié ? » et entrez votre adresse : un lien valable 1 heure vous est envoyé par e-mail. Si vous utilisez Google, choisissez simplement « Continuer avec Google »." },
  { id: "donnees", k: ["donnees", "rgpd", "confidentialite", "supprimer mon compte", "vie privee", "sante"],
    q: "Que deviennent mes données ?",
    a: "Vos mesures (âge, taille, poids) ne sont jamais montrées aux autres joueurs. Vos consommations servent uniquement au jeu et ne sont jamais revendues. Profil → « Supprimer mon compte » efface tout définitivement." },
  { id: "installer", k: ["installer", "appli", "application", "ecran d accueil", "android", "iphone", "apk"],
    q: "Comment installer l'appli ?",
    a: "Dans le navigateur du téléphone : menu → « Ajouter à l'écran d'accueil » (sur iPhone : Partager → Sur l'écran d'accueil). Une appli Android à installer est aussi en préparation." },
  { id: "alerte", k: ["malade", "vomit", "inconscient", "respire", "secours", "15", "urgence", "coma"],
    q: "Un ami ne va pas bien",
    a: "Restez avec lui, ne le laissez pas seul ni dormir sur le dos. S'il vomit, ne répond plus, respire mal ou a la peau froide : appelez le 15 (ou le 112). En attendant, mettez-le en position latérale de sécurité." },
];

const fold = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ");
function search(text) {
  const f = " " + fold(text) + " ";
  return KB.map(e => ({ e, s: e.k.reduce((t, k) => t + (f.includes(" " + fold(k)) ? (k.includes(" ") ? 3 : 2) : 0), 0) + (fold(e.q).split(" ").filter(w => w.length > 3 && f.includes(" " + w)).length) }))
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s).map(x => x.e);
}

async function ai(question, lang) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const base = KB.map(e => `Q : ${e.q}\nR : ${e.a}`).join("\n\n");
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST", headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5", max_tokens: 400,
        system: `Tu es l'aide de l'appli Alamb'hic (jeu de soirée entre amis autour du taux d'alcoolémie estimé, axé sur la modération). Réponds en 2 à 5 phrases, en ${({ en: "anglais", es: "espagnol", pt: "portugais" })[lang] || "français"}, uniquement à partir de la base ci-dessous. Si la base ne répond pas, dis-le et propose la page Confidentialité pour nous écrire. Ne donne jamais de conseil qui encourage à boire davantage ; en cas de malaise, renvoie vers le 15 ou le 112.\n\n${base}`,
        messages: [{ role: "user", content: String(question).slice(0, 500) }] }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return (j.content || []).map(c => c.text || "").join("").trim() || null;
  } catch (e) { return null; }
}

const hits = new Map();
function routes(app) {
  app.get("/api/help", (req, res) => res.json({ items: KB.map(({ id, q, a }) => ({ id, q, a })), ai: !!process.env.ANTHROPIC_API_KEY }));
  app.post("/api/help/ask", async (req, res) => {
    const text = String(req.body && req.body.q || "").trim().slice(0, 500);
    if (!text) return res.status(400).json({ error: "Posez votre question." });
    const now = Date.now(), h = (hits.get(req.ip) || []).filter(t => now - t < 600000); h.push(now); hits.set(req.ip, h);
    if (h.length > 20) return res.status(429).json({ error: "Trop de questions d'affilée. Réessayez dans quelques minutes." });
    const found = search(text).slice(0, 3);
    const answer = await ai(text, req.body.lang);
    res.json({ answer, ai: !!answer, found: found.map(({ id, q, a }) => ({ id, q, a })) });
  });
}
module.exports = { routes, KB, search };
