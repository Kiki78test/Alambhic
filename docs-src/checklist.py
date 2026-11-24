# Check-list Alamb’hic — source de docs/01-pilotage/check-list.pdf (à régénérer à chaque mise à jour importante)
from common import A4, D, band, write

ICON = {"ok": "✔", "test": "◷", "todo": "○"}

def sec(title, items):
    return f"<h2>{title}</h2><ul class='cl'>" + "".join(
        f"<li><span class='b {c}'>{ICON[c]}</span><span>{x}</span></li>" for c, x in items) + "</ul>"

FAIT = [
    ("ok", "<b>Prototype</b> (09/11) : calcul du taux, titres et gages, courbes communes, notifications, avatar évolutif, mode démo avec curseur temporel."),
    ("ok", "<b>Cahier des charges</b> (09/11) : concept, calcul, trophées, alertes, fiabilité et anti-triche, localisation, suivi long terme, supports, monétisation, juridique, architecture, feuille de route."),
    ("ok", "<b>Dépôt GitHub</b> <code>Kiki78test/Alambhic</code> (renommé le 19/11, ex-Youdrink), accès de Claude autorisé."),
    ("ok", "<b>Render</b> (10/11) : Blueprint « youdrink », service web gratuit et base PostgreSQL gratuite, tous deux à Francfort. Adresse : <code>alambhic.onrender.com</code>."),
    ("ok", "<b>Comptes</b> : e-mail + mot de passe (8 caractères minimum, mots de passe chiffrés), connexion gardée 60 jours, limitation des essais de connexion."),
    ("ok", "<b>Profil</b> : pseudo, sexe, âge (18 ans minimum), taille, poids, plafond perso. Les mesures ne sont jamais montrées aux autres joueurs."),
    ("ok", "<b>Soirées par code</b> de 4 lettres : créer, rejoindre, partager l'invitation, quitter. Une seule soirée active à la fois."),
    ("ok", "<b>Calcul serveur</b> des taux, titres et points, diffusé en temps réel à tous les joueurs (WebSocket, rafraîchi chaque minute)."),
    ("ok", "<b>Avatar détaillé</b> qui évolue avec le taux, avec le verre en main pendant 25 min après chaque verre."),
    ("ok", "<b>Mode démo</b> accessible à tous (bouton « Démo » en haut) : soirée fictive de 19 h à 6 h, curseur et lecture accélérée."),
    ("ok", "<b>Suivi des 7 derniers jours</b> sur la page Profil, comparé aux repères de Santé publique France."),
    ("ok", "<b>Anti-triche, première série</b> : verre antidaté de 3 h au plus, suppression possible pendant 3 h et visible dans le fil, 6 verres d'alcool au plus en 10 min, Sam limité aux boissons sans alcool."),
    ("ok", "<b>Suppression du compte</b> avec effacement de toutes les données (RGPD)."),
    ("ok", "<b>Appli installable</b> sur le téléphone (icône, plein écran, fonctionne hors ligne pour l'interface)."),
    ("ok", "<b>Repas</b> (10/11) : repas du jour demandés avant le premier verre (heure et type, ou « rien mangé »), ajout d'un repas à tout moment, question « avez-vous mangé ? » à l'heure des repas ; quatre types de repas qui ralentissent l'absorption et baissent le pic. Remplace l'option « J'ai mangé »."),
    ("ok", "<b>Connexion Google</b> (10/11) : projet Google Cloud « YouDrink », client OAuth Web, <code>GOOGLE_CLIENT_ID</code> sur Render ; bouton « Continuer avec Google » vérifié en ligne ; application <b>publiée en production</b> (ouverte à tout compte Google)."),
    ("ok", "<b>Pages légales</b> (10/11) : politique de confidentialité et conditions d'utilisation publiques, case de consentement à la création du compte (données de santé)."),
    ("ok", "<b>Nouveau nom : Alamb’hic</b> (10/11) : « YouDrink » est déjà une appli américaine (youdrink.com) ; Godet écarté (marque GODET de Godet Frères Cognac en classe 33), Alambix écarté (personnage d'Astérix). Logo « potion » bleu et blanc et thème bleu en place (à affiner)."),
    ("ok", "<b>Nouvelle adresse</b> (10/11) : service Render « alambhic » sur <code>alambhic.onrender.com</code>, base renommée <code>alambhic-db</code>, variables et origine Google en place, Node 22 fixé ; Google et contact vérifiés en ligne."),
    ("todo", "<b>Supprimer l'ancien service Render « youdrink »</b> (service web uniquement, pas la base)."),
    ("ok", "<b>Test à deux comptes</b> (10/11) : soirée créée et rejointe par code sur alambhic.onrender.com, verres des deux joueurs, courbes communes en temps réel."),
    ("ok", "<b>Design des notifications</b> (10/11) : une notification à la fois avec file d'attente, icônes et barre de temps ; confirmations en bas avec « Annuler » ; boutons de boisson avec état d'envoi et coche verte (fin des doubles saisies)."),
    ("ok", "<b>Écran « Potes » en direct</b> (10/11) : taux, avatar, tendance façon bourse (▲/▼ en g/L par heure), mini-courbe, dernier titre."),
    ("ok", "<b>Animations</b> (10/11) : jauge en serpentin d'alambic, goutte qui vole jusqu'au tuyau, titre qui fait « hic ! », tendance qui clignote, fiole de chargement ; coupées si le téléphone réduit les animations."),
    ("ok", "<b>Avatar vivant</b> (10/11) : balancement selon le taux, sursaut et bulle à chaque changement d'état."),
    ("ok", "<b>Banc de test sur ordinateur</b> (10/11) : <code>/demo.html</code>, la soirée fictive en grand avec frise temporelle, avatars, titres et courbes."),
    ("ok", "<b>Business plan</b> (10/11) : document dans l'onglet Documentation, à enrichir au fil des idées."),
    ("ok", "<b>Liste d'amis</b> (10/11) : code ami, lien d'invitation, demandes, amis en direct (taux, tendance, mini-courbe, dernier titre), partage désactivable."),
    ("todo", "<b>Widget « mes potes »</b> sur l'APK et la montre (les notifications des titres des amis hors soirée sont faites, voir ci-dessous) (avec l'APK)."),
    ("ok", "<b>Nouvel avatar</b> (10/11) : portrait dans un cercle en 10 stades (du sourire au KO), d'après la planche fournie. Version femme à venir."),
    ("ok", "<b>Gages supprimés</b> (10/11) : les titres de honte coûtent seulement des points."),
    ("ok", "<b>Badges à paliers</b> (23/11) : six badges bronze, argent, or sur tout l'historique (Habitué, Chameau d'or, Sam fidèle, Sans fausse note, Pilote de ligne, Bande de potes), dans le Profil, notification à chaque palier."),
    ("ok", "<b>Notifications push appli fermée</b> (23/11) : Profil → Notifications ; 5 catégories réglables (alertes, titres de la soirée, titres des amis hors soirée, rappel repas, badges) ; clés créées automatiquement. Testé : un 2e joueur reçoit les titres du 1er."),
    ("ok", "<b>Garde-fou sur les pseudos</b> (23/11) : insultes, adresses, numéros et liens refusés (repris d'Airmony)."),
    ("ok", "<b>Sécurité</b> (23/11) : GitHub Actions « Sécurité des dépendances » chaque lundi."),
    ("ok", "<b>Mot de passe oublié</b> (23/11) : lien par e-mail valable 1 h (Resend) ; actif dès que <code>RESEND_API_KEY</code> est renseignée."),
    ("ok", "<b>Aide</b> (23/11) : 17 questions fréquentes avec recherche ; assistant IA facultatif (<code>ANTHROPIC_API_KEY</code>)."),
    ("ok", "<b>Visite guidée</b> (23/11) : 5 bulles au premier lancement de la démo, bouton « Visite »."),
    ("ok", "<b>Quatre langues</b> (23/11) : français, anglais, espagnol, portugais (interface, titres, notifications de soirée, pages TV et récap)."),
    ("ok", "<b>Appli Android</b> (23/11) : enveloppe Capacitor dans <code>mobile/</code>, APK de test fabriqué par GitHub Actions (Releases → « Appli Android (test) »)."),
    ("ok", "<b>Écran TV</b> (23/11) : <code>/tv</code> avec un code à 6 caractères ; vues Avatars, Courbes, Fil ou Auto ; le téléphone sert de télécommande ; titres annoncés en grand."),
    ("ok", "<b>Récap à partager</b> (23/11) : lien public <code>/r/…</code> avec avatars, courbes et titres ; seuls les joueurs volontaires y figurent (pseudo seulement)."),
    ("ok", "<b>Verres notés partout</b> (24/11) : nouvel accueil à cinq onglets (Moi, Sessions, Agenda, Groupes, Soirées) ; un verre noté pendant une soirée en cours s'y rattache tout seul."),
    ("ok", "<b>Sessions</b> (24/11) : découpage automatique du premier verre au retour à 0, une courbe par session (fini la courbe trop large)."),
    ("ok", "<b>Agenda</b> (24/11) : jours en vert (1-2), orange (3-5) ou rouge (6 et +), total par semaine, alertes bienveillantes avec Alcool info service."),
    ("ok", "<b>Groupes de potes</b> (24/11) : code ou lien d'invitation, courbes de tous les membres par créneaux de 48 h, navigation dans le temps."),
    ("ok", "<b>Soirées à code datées</b> (24/11) : début et fin prévus, courbe limitée à la soirée, liste des soirées à venir, en cours et passées."),
    ("ok", "<b>Onglet Documentation</b> (10/11) réservé aux admins : présentation complète, guide complet, check-list, services externes."),
]
A_TESTER = [
    ("test", "<b>Variable Render <code>ADMIN_EMAILS</code></b> : y mettre votre adresse e-mail pour voir le bouton « Docs »."),
    ("test", "<b>Variable <code>CONTACT_EMAIL</code></b> sur Render : adresse de contact affichée dans les pages légales."),
    ("test", "<b>Amis</b> : s'ajouter mutuellement avec le lien d'invitation, voir le taux de l'autre pendant une soirée, couper le partage."),
    ("test", "<b>Connexion Google</b> : se connecter avec « Continuer avec Google » depuis le téléphone."),
    ("test", "<b>Création de compte et profil</b> sur alambhic.onrender.com, depuis le téléphone puis l'ordinateur."),
    ("test", "<b>Repas</b> : en entrant dans la soirée, renseigner les repas du jour (heure et type) avant le premier verre ; ajouter un repas en cours de soirée ; vérifier la question « avez-vous dîné ? » entre 19 h 30 et 22 h (et « avez-vous déjeuné ? » entre 12 h et 14 h 30), avec l'heure du repas à indiquer."),
    ("test", "<b>Installation</b> : menu du navigateur → « Ajouter à l'écran d'accueil »."),
    ("test", "<b>Mode démo</b> : curseur et lecture, déblocage des titres, évolution des avatars."),
    ("test", "<b>Notifications push</b> : Profil → Notifications → « Activer » puis « Tester », sur Android (Chrome) et sur iPhone (appli installée sur l'écran d'accueil) ; vérifier qu'un ami de la soirée reçoit vos titres appli fermée."),
    ("test", "<b>Écran TV</b> : ouvrir <code>alambhic.onrender.com/tv</code> sur la TV ou un ordinateur, saisir le code, changer la vue depuis le téléphone."),
    ("test", "<b>Récap</b> : créer le lien, l'ouvrir sur un autre appareil, décocher « Apparaître » et vérifier qu'on disparaît."),
    ("test", "<b>APK de test</b> : GitHub → Releases → « Appli Android (test) » (après la première fabrication), installer sur un Android ; vérifier la connexion (Google peut refuser la vue intégrée)."),
    ("test", "<b>Langues et aide</b> : passer en English / Español / Português (Profil → Langue) ; poser une question dans l'aide ; lancer la démo et suivre la visite."),
    ("test", "<b>Nouvel accueil</b> : noter un verre hors soirée, voir la session en cours, l'onglet Sessions puis une session ; l'agenda du mois ; créer un groupe, inviter un ami avec le lien, naviguer par 48 h ; créer une soirée datée et vérifier que la courbe va du début à la fin."),
    ("test", "<b>Vraie soirée entre amis</b> : validation de l'étape 1 avant de passer à l'APK."),
]
A_FAIRE = [
    ("todo", "<b>Marque Alamb’hic</b> : export INPI sur « alambic » et « alambhic » (classes 9, 41, 42), puis dépôt INPI ; choisir l'écriture définitive (Alamb’hic / AlambHic)."),
    ("todo", "<b>Logo définitif</b> : choisir parmi les pistes A à D (brand/propositions-logo.png) ou fournir le vôtre."),
    ("todo", "<b>Google</b> : Branding → nom de l'application « Alamb’hic » (le projet peut garder son nom)."),
    ("todo", "<b>Nom de domaine</b> (alambhic.app, .fr ou .com) sur Cloudflare, puis branchement sur Render ; l'ajouter aux origines du client Google et, dans Branding, remettre page d'accueil, confidentialité, conditions et domaine autorisé."),
    ("todo", "<b>Variables Render pour les e-mails</b> : <code>RESEND_API_KEY</code> (clé de l'équipe Resend « Airmony »), <code>MAIL_FROM</code> (ex. « Alamb'hic &lt;noreply@domaine vérifié&gt; »), <code>BASE_URL</code> = https://alambhic.onrender.com. Facultatif : <code>ANTHROPIC_API_KEY</code> pour l'assistant de l'aide."),
    ("todo", "<b>UptimeRobot</b> : sonde sur https://alambhic.onrender.com/healthz (alerte e-mail si le site tombe)."),
    ("todo", "<b>Paiements Stripe</b> (Premium, Pass soirée) : reportés, à reprendre d'Airmony le moment venu."),
    ("todo", "<b>Traduire les réponses de l'aide</b> et les messages du serveur (aujourd'hui en français dans toutes les langues)."),
    ("todo", "<b>Étape 2 — APK Android, suite</b> : notifications natives Firebase dans l'appli (projet Firebase, <code>google-services.json</code>, <code>FCM_SERVICE_ACCOUNT</code>), widget écran d'accueil, publication Google Play."),
    ("todo", "<b>Étape 3 — Fiabilité</b> : saisie d'un éthylotest et recalibrage personnel, éthylotest Bluetooth, validation des verres par les amis, indice de fiabilité."),
    ("todo", "<b>Étape 4 — Montre et long terme</b> : Wear OS (ajout d'un verre, vibration aux seuils, gorgées détectées par l'inclinaison), tableau de bord mensuel, objectifs, trophées long terme."),
    ("todo", "<b>Étape 5 — Ouverture publique</b> : localisation approximative et défis entre soirées, publicités cohérentes (VTC, repas, sans alcool), version premium."),
    ("todo", "<b>Verres favoris</b> : dans le profil, choisir ses verres favoris, affichés en premier sur l'écran Moi ; en soirée, bouton « Autre verre » ouvrant un catalogue avec recherche. Catalogue à valider (volume · degré) : <i>bières</i> demi 25 cl · 5 %, pinte 50 cl · 5 %, bière forte 33 cl · 8 %, IPA 33 cl · 6,5 %, panaché 25 cl · 2,5 %, Monaco 25 cl · 3 % ; <i>vins</i> rouge, blanc, rosé 12 cl · 12,5 %, champagne 12 cl · 12 %, kir 12 cl · 11 %, sangria 15 cl · 8 % ; <i>apéritifs</i> pastis 2 cl dilué · 45 %, Martini 7 cl · 15 %, Suze 5 cl · 15 %, Lillet 7 cl · 17 %, porto 7 cl · 19 %, Spritz 20 cl · 8 % ; <i>alcools forts</i> shot 4 cl · 40 % (vodka, rhum, tequila, gin, whisky), Jägermeister 4 cl · 35 %, limoncello 4 cl · 30 %, Get 27 4 cl · 21 % ; <i>mélanges</i> Jäger Bomb (4 cl Jäger + Red Bull), gin tonic, rhum-coca, vodka-Red Bull, whisky-coca 25 cl · 4 cl d'alcool, mojito 25 cl · 10 %, piña colada 25 cl · 10 %, Long Island 30 cl · 20 % ; <i>autres</i> cidre 25 cl · 5 %, hard seltzer 33 cl · 4,5 %, verre de punch 15 cl · 15 % ; <i>sans alcool</i> eau, soda, bière 0,0 %. Garder la saisie libre volume + degré."),
    ("ok", "<b>Jauge alambic</b> (10/11) : ballon en verre, chapiteau et col de cygne en cuivre ; la potion monte avec le taux, bulles, flamme, goutte au bout du tuyau et vapeur au-delà de la moitié. Remplace la spirale ; à remplacer plus tard par une version faite par IA."),
    ("todo", "<b>Visuels par IA</b> (jauge, avatars, logo) : 1) <b>Recraft</b> (recraft.ai), en priorité : vrais fichiers vectoriels SVG et style constant d'une image à l'autre, découpables et animables ; 2) <b>Midjourney ou ChatGPT (images)</b> : beau rendu mais images figées (PNG) ; pour la jauge, demander une version vide et une version pleine superposables ; 3) <b>LottieFiles</b> (Lottie Creator et son assistant IA) : vraie animation, plus de travail."),
    ("todo", "<b>Avatar femme</b> : à dessiner d'après les prochaines images (le sexe du profil choisira la version)."),
    ("todo", "<b>Juridique</b> avant toute ouverture publique : loi Évin, règles des stores, RGPD (analyse d'impact, politique de confidentialité, mentions légales)."),
    ("todo", "<b>Hébergement comme les autres projets</b> : Render payant (service web + base) et domaine sur Cloudflare, avec Airmony, AnagramX et Hermaion."),
    ("todo", "<b>Offres payantes Render</b> : le Blueprint demande Starter (~7 $/mois) et une base basic-256mb (~6 $/mois) ; vérifier sur Render que les deux sont bien actives (Sync du Blueprint)."),
]

CSS = A4 + """
.cl{list-style:none;padding:0}
.cl li{display:grid;grid-template-columns:7mm 1fr;gap:2mm;padding:1.8mm 0;border-bottom:1px solid var(--rule);break-inside:avoid}
.b{width:5mm;height:5mm;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:8pt;font-weight:700;margin-top:.4mm}
.b.ok{background:var(--ok);color:#06210f}.b.test{background:var(--warn);color:#2a2000}.b.todo{background:transparent;border:1.4px solid var(--soft);color:var(--soft)}
.legend{display:flex;gap:6mm;font-size:9pt;color:var(--soft);margin-bottom:4mm}
.legend span{display:inline-flex;gap:2mm;align-items:center}
.count{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm;margin:0 0 6mm}
.count div{background:var(--paper2);border-radius:3mm;padding:3mm 4mm}
.count b{font-family:'Bricolage',sans-serif;font-size:20pt;display:block;line-height:1.1}
"""

body = f"""<div class="page">{band("Check-list", "Pilotage du projet")}
<p class="lead">Étape 1 de la feuille de route : le socle web est en ligne. Il reste à le tester en vraie soirée avant de passer à l'APK Android.</p>
<div class="count"><div><b>{len(FAIT)}</b>fait</div><div><b>{len(A_TESTER)}</b>à tester par vous</div><div><b>{len(A_FAIRE)}</b>à faire</div></div>
<div class="legend"><span><span class="b ok">✔</span>fait</span><span><span class="b test">◷</span>à tester</span><span><span class="b todo">○</span>à faire</span></div>
{sec("À tester par vous", A_TESTER)}
{sec("À faire", A_FAIRE)}
{sec("Fait", FAIT)}
<div class="foot"><span>Alamb’hic · Check-list</span><span>{D}</span></div></div>"""

write("checklist.html", f"<style>{CSS}</style></head><body>{body}</body></html>", "Check-list Alamb’hic")
