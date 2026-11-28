# Services externes Alamb’hic — source de docs/01-pilotage/services-externes.pdf (à tenir à jour à chaque changement de service)
from common import A4, D, band, write

ACTIFS = [
    ("GitHub", "Dépôt privé <code>Kiki78test/Alambhic</code> : code source et documentation.", "Gratuit", "Code uniquement", "Accès de l'appli Claude autorisé sur le dépôt."),
    ("Render — service web", "Héberge le serveur Node (site, API, temps réel, pages légales). Redéploie à chaque envoi sur <code>main</code>.", "Offre Starter, ~7 $/mois (toujours éveillé)", "Transit des données des joueurs", "Région Francfort. Blueprint <code>render.yaml</code>. Variables : <code>SESSION_SECRET</code> (générée), <code>DATABASE_URL</code> (reliée), <code>GOOGLE_CLIENT_ID</code>, <code>ADMIN_EMAILS</code>, <code>CONTACT_EMAIL</code>, <code>MONITOR_KEY</code>, <code>MONITOR_ORIGIN</code>, <code>RESEND_API_KEY</code>, <code>MAIL_FROM</code>, <code>BASE_URL</code>, <code>ANTHROPIC_API_KEY</code> (facultatif)."),
    ("Render — PostgreSQL", "Base de données : comptes, profils, soirées, verres, titres.", "Offre basic-256mb, ~6 $/mois (sauvegardes quotidiennes, pas d'expiration)", "Toutes les données des joueurs, dont les consommations (données sensibles)", "Région Francfort, même région que le service (obligatoire pour la connexion interne)."),
    ("Google Identity", "Bouton « Continuer avec Google ».", "Gratuit", "E-mail, prénom, identifiant Google", "Projet Google Cloud « YouDrink », client OAuth « Application Web », origine autorisée <code>https://alambhic.onrender.com</code> (ajouter le futur domaine). Variable <code>GOOGLE_CLIENT_ID</code>."),
    ("Web Push (navigateurs)", "Notifications appli fermée : le serveur chiffre chaque notification et la remet au service du navigateur (Google pour Chrome et Android, Apple, Mozilla, Microsoft).", "Gratuit", "Adresse d'abonnement de l'appareil, texte chiffré des notifications", "Clés VAPID créées automatiquement et gardées en base (table <code>settings</code>) ; ou variables <code>VAPID_PUBLIC_KEY</code> / <code>VAPID_PRIVATE_KEY</code>. Rien à faire sur Render."),
    ("Resend", "E-mails : lien de nouveau mot de passe.", "Gratuit jusqu'à 3 000 e-mails/mois", "Adresse e-mail du joueur", "Même équipe Resend qu'Airmony et Hermaion. Variables <code>RESEND_API_KEY</code>, <code>MAIL_FROM</code> (expéditeur sur un domaine vérifié dans Resend), <code>BASE_URL</code>. <b>À renseigner</b> : sans clé, le mot de passe oublié affiche « envoi pas encore activé »."),
    ("GitHub Actions", "Contrôle de sécurité des dépendances chaque lundi ; fabrication de l'APK de test.", "Gratuit (minutes incluses)", "Code uniquement", "Fichiers <code>.github/workflows/securite.yml</code> et <code>android.yml</code>. APK dans Releases → « Appli Android (test) »."),
    ("Anthropic (facultatif)", "Assistant de l'aide : reformule une réponse à partir des questions fréquentes.", "Au message (quelques centimes par jour au plus)", "Texte de la question, sans identité", "Variable <code>ANTHROPIC_API_KEY</code> (et <code>ANTHROPIC_MODEL</code>, par défaut claude-sonnet-5-5). Sans clé, l'aide fonctionne avec les réponses toutes prêtes."),
    ("OpenStreetMap (Overpass)", "« Autour de moi » : bars, restaurants, cafés et boîtes de nuit proches, pour choisir le lieu de la cuvée.", "Gratuit (usage raisonnable)", "Position approximative, envoyée par notre serveur seulement au moment de la recherche (ni identité ni adresse IP du joueur ; rien n'est enregistré)", "Aucune clé. Serveur principal overpass-api.de, secours overpass.kumi.systems ; résultats gardés 10 min par zone d'environ 100 m, 20 recherches par joueur et par 10 min. Si le service est indisponible, la saisie libre et les favoris restent possibles. Alternative payante plus complète : Google Places."),
    ("Google Fonts", "Polices Bricolage Grotesque et Inter de l'interface.", "Gratuit", "Adresse IP du visiteur (chargement des polices)", "À héberger nous-mêmes avant l'ouverture publique pour ne plus rien envoyer à Google."),
]
PREVUS = [
    ("Cloudflare", "Nom de domaine, DNS, protection.", "Domaine ~10 à 15 €/an", "Trafic du site (proxy)", "Comme airmonylive.com."),
    ("Firebase Cloud Messaging", "Notifications natives dans l'appli Android (l'enveloppe ne reçoit pas les push du navigateur).", "Gratuit", "Jeton de l'appareil, texte des notifications", "Projet Firebase, fichier <code>google-services.json</code>, variable <code>FCM_SERVICE_ACCOUNT</code>, comme Airmony."),
    ("UptimeRobot", "Alerte par e-mail si le site ne répond plus.", "Gratuit", "Aucune", "Sonde sur <code>https://alambhic.onrender.com/healthz</code>, comme Airmony."),
    ("Rive", "Avatar animé (personnage articulé, 10 stades, gorgée) lu par le moteur web de Rive.", "Offre gratuite pour l'éditeur au départ ; animation à faire réaliser (devis)", "Aucune (fichier d'animation servi par notre site)", "Cahier des charges : docs « Cahier des charges Rive ». Bibliothèque @rive-app/canvas (environ 150 Ko) à charger seulement si le fichier existe."),
    ("Google Play Console", "Publication de l'APK.", "25 $ une fois", "Fiche de l'appli", "Compte déjà utilisé pour vos autres applis."),
]

def table(rows):
    return "<table><tr><th>Service</th><th>Rôle</th><th>Coût</th><th>Données confiées</th><th>Réglages</th></tr>" + "".join(
        f"<tr><td><b>{a}</b></td><td>{b}</td><td>{c}</td><td>{d}</td><td>{e}</td></tr>" for a, b, c, d, e in rows) + "</table>"

body = f"""<div class="page">{band("Services externes", "Pilotage du projet")}
<p class="lead">Alamb’hic tourne sur GitHub, Render (service web et base), la connexion Google, les services de notification des navigateurs et, une fois la clé renseignée, Resend pour les e-mails. OpenStreetMap fournit les lieux proches. L'assistant IA de l'aide est facultatif.</p>
<h2>En service</h2>{table(ACTIFS)}
<h2>Prévus</h2>{table(PREVUS)}
<div class="note warn"><b>Données sensibles.</b> Les consommations d'alcool sont des données de santé au sens du RGPD. Tous les sous-traitants qui les reçoivent devront être listés dans la politique de confidentialité avant l'ouverture publique.</div>
<div class="foot"><span>Alamb’hic · Services externes</span><span>{D}</span></div></div>"""

write("services.html", f"<style>{A4}</style></head><body>{body}</body></html>", "Services externes Alamb’hic")
