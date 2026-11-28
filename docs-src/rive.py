# Cahier des charges de l'avatar animé (Rive) — source de docs/02-presentation/cahier-des-charges-rive.pdf
from common import A4, D, band, write

CSS = A4 + """
.t td,.t th{vertical-align:top}
.t td:first-child{white-space:nowrap}
.ref{display:block;width:150mm;height:auto;margin:2mm auto 1mm;border-radius:3mm}
.cap{font-size:8.4pt;color:var(--muted);margin:0 0 4mm}
code{font-size:8.8pt;background:var(--paper2);padding:.2mm 1.4mm;border-radius:1.4mm}
.sw{display:inline-block;width:3.6mm;height:3.6mm;border-radius:1mm;vertical-align:-0.6mm;margin-right:1.4mm;border:.2mm solid rgba(0,0,0,.2)}
"""

STADES = [
 ("0 · En forme", "0", "Yeux grands ouverts, grand sourire", "Coiffé", "Chemise impeccable, cravate nouée", "—", "Respire, cligne des yeux"),
 ("1 · Premier verre", "0,05", "Sourire franc, yeux pétillants", "Coiffé", "Idem", "—", "Idem"),
 ("2 · Détendu", "0,20", "Paupières un peu lourdes, sourire doux", "Coiffé", "Idem", "Léger rose aux joues", "Léger balancement"),
 ("3 · Pompette", "0,35", "Clin d'œil, sourire en coin", "Une mèche s'échappe", "Col ouvert, cravate desserrée", "Petites étincelles", "Balancement léger"),
 ("4 · Éméché", "0,50", "Un œil mi-clos, cernes légers, bouche entrouverte", "Ébouriffé", "Cravate de travers", "Bulles qui flottent", "Hoquet de temps en temps"),
 ("5 · Fou rire", "0,65", "Yeux plissés de rire, langue tirée", "Ébouriffé", "Cravate qui pend, chemise froissée", "Bulles", "Rire (épaules qui sautent), hoquet"),
 ("6 · Hilare", "0,80", "Rire aux éclats, nez rouge", "En bataille", "Tache de vin sur la chemise", "Bulles", "Rire, hoquet, balancement marqué"),
 ("7 · Ça tourne", "1,00", "Yeux qui flottent (pupilles qui tournent), bouche en vague, goutte de sueur", "En bataille", "Idem", "Spirale au-dessus de la tête", "Tangue franchement, hoquet"),
 ("8 · Les étoiles", "1,20", "Yeux dans le vague, bouche grande ouverte, langue", "Très en bataille", "Cravate presque défaite", "Couronne d'étoiles qui tourne", "Tangue fort, hoquet"),
 ("9 · KO", "1,50", "Endormi, filet de bave, larme", "Très en bataille", "Débraillé", "Étoiles et « z z »", "Tête penchée, respiration lente ; tient un verre d'eau posé à côté"),
]
INPUTS = [
 ("stage", "Number (0 à 9)", "Stade courant, calculé par l'appli à partir du taux (seuils fixes ci-dessus, identiques pour tous les joueurs). Le passage d'un stade à l'autre doit être fluide (transition de 0,3 à 0,6 s), dans les deux sens."),
 ("glass", "Number (0 à 6)", "Verre en main : 0 aucun, 1 bière, 2 vin, 3 champagne, 4 cocktail, 5 shot, 6 eau. Le verre change sans à-coup (il disparaît puis apparaît dans la main)."),
 ("sip", "Trigger", "Gorgée : déclenché à chaque verre noté. Le bras se plie, le verre arrive à la bouche et s'incline, la tête part légèrement en arrière, puis tout revient. Durée 1,4 à 1,8 s. Sans effet si glass = 0 ou au stade 9."),
 ("stageUp", "Trigger", "Sursaut au changement de stade (petit saut et rebond, 0,6 à 0,9 s). L'appli affiche elle-même la bulle de texte avec le nom du stade."),
 ("calm", "Boolean", "Animations réduites (réglage « réduire les animations » du téléphone) : plus de balancement ni de hoquet, seulement le clignement et la respiration très discrète."),
 ("shirt", "Color (propriété de données)", "Couleur de la chemise, différente pour chaque joueur (couleur de sa courbe). Si la couleur pilotable pose problème : prévoir 8 variantes de chemise, voir la palette."),
]
GESTES = [
 ("Respiration", "Toujours", "Cycle de 3,5 à 4 s : torse et épaules montent d'environ 1 % ; plus lent et plus ample au stade 9."),
 ("Clignement", "Stades 0 à 8 (sauf quand les yeux sont fermés de rire)", "Toutes les 3 à 6 s, à intervalle irrégulier ; parfois un double clignement."),
 ("Balancement", "Stades 2 à 8", "Le buste tangue autour des hanches ; amplitude qui augmente avec le stade (de 1° à 8° environ), la tête suit avec un léger retard."),
 ("Hoquet", "Stades 4 à 8", "Petit sursaut de la tête et des épaules toutes les 5 à 8 s."),
 ("Rire", "Stades 5 et 6", "Épaules qui sautent par petites saccades, de temps en temps."),
 ("Gorgée", "Trigger sip", "Voir l'input sip. Le coude doit vraiment se plier : le bras reste attaché à l'épaule, le cou suit la tête sans se détacher du col."),
 ("Sursaut", "Trigger stageUp", "Petit saut avec rebond élastique."),
 ("Endormi", "Stade 9", "Tête penchée sur le côté, bulle de bave qui gonfle et dégonfle, « z » qui montent."),
]
VERRES = [
 ("Bière", "Chope avec anse, mousse blanche qui déborde un peu, bulles qui montent dans la bière blonde."),
 ("Vin", "Verre à pied, vin rouge au tiers, reflet sur le verre ; tenu par le pied."),
 ("Champagne", "Flûte, liquide doré, fines bulles qui montent ; tenue par le pied."),
 ("Cocktail", "Verre en V, liquide rose, cerise sur pique, tranche de citron sur le bord."),
 ("Shot", "Petit verre épais, liquide ambré ; tenu entre les doigts."),
 ("Eau", "Grand verre droit, eau bleutée, deux glaçons ; c'est le verre posé à côté de lui au stade 9."),
]
PALETTE = [("#0a1626", "Fond de l'appli (bleu nuit)"), ("#10233b", "Cartes"), ("#2f8cff", "Accent bleu, chemise par défaut"),
 ("#f3c39e", "Peau"), ("#df9f78", "Ombre de peau"), ("#4b2b18", "Cheveux"), ("#2b1810", "Traits de contour"),
 ("#3fbf8a", "Anneau stade 0 (vert)"), ("#f2b233", "Anneau stade 3 (jaune)"), ("#ee4436", "Anneau stade 6 (rouge)"), ("#e0306f", "Anneau stade 9 (rose)")]
CHEMISES = ["#2f8cff", "#ff7a59", "#5bc88a", "#c77dff", "#ffcf4a", "#ff5c8a", "#4dd4e8", "#a3b8cc"]

st = "".join(f"<tr><td><b>{a}</b></td><td>{b}</td><td>{c}</td><td>{d}</td><td>{e}</td><td>{f}</td><td>{g}</td></tr>" for a, b, c, d, e, f, g in STADES)
inp = "".join(f"<tr><td><code>{a}</code></td><td>{b}</td><td>{c}</td></tr>" for a, b, c in INPUTS)
ges = "".join(f"<tr><td><b>{a}</b></td><td>{b}</td><td>{c}</td></tr>" for a, b, c in GESTES)
ver = "".join(f"<tr><td><b>{a}</b></td><td>{b}</td></tr>" for a, b in VERRES)
pal = "".join(f"<tr><td><span class='sw' style='background:{c}'></span><code>{c}</code></td><td>{l}</td></tr>" for c, l in PALETTE)
chem = " ".join(f"<span class='sw' style='background:{c}'></span><code>{c}</code>" for c in CHEMISES)

body = f"""<div class="page">{band("Avatar animé : cahier des charges", "Pour l'illustrateur et l'animateur Rive")}
<p class="lead" style="margin-bottom:2mm">Alamb’hic est un jeu de soirée qui estime le taux d'alcool de chaque joueur et l'incite à se modérer avec humour. Son avatar, un personnage en buste dans un cercle, change d'expression selon le taux (10 stades) et tient le dernier verre bu. Ce document décrit le personnage animé à livrer au format <b>Rive</b> (rive.app), qui remplacera le dessin actuel, fait en code.</p>

<h2>1. Ce qu'il faut livrer</h2>
<ul>
<li>Un fichier <code>avatar.riv</code> (exporté pour le web) et sa source <code>.rev</code>.</li>
<li>Un plan de travail (artboard) nommé <code>Avatar</code>, carré <b>240 × 240</b>, fond transparent. Le personnage est cadré en buste, centré, et tient dans un cercle de 220 de diamètre : l'appli ajoute elle-même le fond rond, l'anneau de couleur du stade et le badge « clés confisquées ».</li>
<li>Une machine à états nommée <code>Etat</code>, avec exactement les entrées décrites au point 4 (noms sensibles à la casse).</li>
<li>Un aperçu vidéo (MP4 ou GIF) de chaque stade et de chaque geste, pour la validation.</li>
<li>Plus tard, avec le même squelette : une version femme (plan de travail <code>AvatarF</code>), voir le point 9.</li>
</ul>

<h2>2. Le personnage</h2>
<ul>
<li>Homme de 25 à 35 ans, sympathique, visage expressif ; style cartoon plat moderne, contours fins, ombres franches (aplats, pas de dégradés lourds), comme le dessin actuel ci-dessous en plus abouti.</li>
<li>Chemise de couleur (couleur propre à chaque joueur), col blanc, cravate bleu foncé ; la tenue se défait au fil des stades.</li>
<li>Lisible en petit : il s'affiche entre <b>52 et 120 pixels</b> dans l'appli (jusqu'à 400 sur l'écran TV). Expressions marquées, peu de petits détails.</li>
<li>Humour bienveillant : il devient drôle, jamais pathétique ni sale.</li>
</ul>
<img class="ref" src="img/rive-stades.png" alt="Les 10 stades de l'avatar actuel">
<p class="cap">Référence : les 10 stades de l'avatar actuel (dessin en code). Garder les idées (expressions, cheveux, cravate, effets), en mieux.</p>
<h2>3. Les 10 stades</h2>
<p style="font-size:9pt">Seuil = taux estimé en g/L à partir duquel le stade s'affiche. L'appli calcule le stade et le transmet à l'animation (entrée <code>stage</code>).</p>
<table class="t"><tr><th>Stade</th><th>Seuil</th><th>Visage</th><th>Cheveux</th><th>Tenue</th><th>Effets autour</th><th>Mouvement de repos</th></tr>{st}</table>

<h2>4. Machine à états <code>Etat</code> : entrées</h2>
<table class="t"><tr><th>Nom</th><th>Type</th><th>Rôle</th></tr>{inp}</table>
<div class="note">Toutes les animations de repos doivent boucler sans saut. Aucun texte dans l'animation (l'appli est traduite en 4 langues) : les bulles de texte sont ajoutées par l'appli.</div>
<div class="foot"><span>Alamb’hic · Cahier des charges Rive</span><span>{D}</span></div></div>

<div class="page">
<h2>5. Les gestes</h2>
<table class="t"><tr><th>Geste</th><th>Quand</th><th>Description</th></tr>{ges}</table>

<h2>6. Les verres tenus</h2>
<p style="font-size:9pt">Toujours dans la main gauche du personnage (à droite de l'image), bras levé à hauteur d'épaule ; la main entoure vraiment le verre.</p>
<table class="t"><tr><th>Verre</th><th>Description</th></tr>{ver}</table>
<img class="ref" src="img/rive-verres.png" alt="Verres actuels">
<p class="cap">Référence : les verres du dessin actuel.</p>
<div class="foot"><span>Alamb’hic · Cahier des charges Rive</span><span>{D}</span></div></div>

<div class="page">
<h2>7. Contraintes techniques</h2>
<ul>
<li>Lu dans le navigateur et l'appli Android avec le moteur web de Rive (<code>@rive-app/canvas</code>), sur des téléphones de milieu de gamme : <b>60 images/s</b>, fichier de <b>moins de 150 Ko</b> si possible.</li>
<li>Formes vectorielles de préférence (pas d'images bitmap, ou très peu et légères).</li>
<li>Plusieurs avatars peuvent tourner en même temps à l'écran (jusqu'à 8 joueurs) : animations sobres en calcul.</li>
<li>Traits d'au moins 1,5 à l'échelle 240 pour rester visibles à 52 pixels.</li>
<li>Couleur de chemise pilotable par l'appli ; à défaut, 8 variantes : {chem}</li>
</ul>
<h3>Palette de l'appli</h3>
<table class="t"><tr><th>Couleur</th><th>Usage</th></tr>{pal}</table>

<h2>8. À éviter</h2>
<ul>
<li>Aucune marque d'alcool, aucune étiquette lisible ; pas de cigarette.</li>
<li>Rien qui présente l'ivresse comme un exploit (loi Évin, règles de Google Play) : les stades élevés restent comiques mais visiblement « pas en forme ».</li>
<li>Pas de vomi, pas de chute violente, pas de clé de voiture en main.</li>
</ul>
<div class="foot"><span>Alamb’hic · Cahier des charges Rive</span><span>{D}</span></div></div>

<div class="page">
<h2>9. Étapes et validation</h2>
<table class="t"><tr><th>Étape</th><th>Livrable</th><th>Validation</th></tr>
<tr><td><b>1. Dessin</b></td><td>Le personnage en 10 stades, images fixes (6 verres en main sur le stade 1)</td><td>Allers-retours sur le style avant toute animation</td></tr>
<tr><td><b>2. Squelette</b></td><td>Personnage articulé dans Rive (tête, cou, buste, bras, avant-bras, main, verre, paupières, bouche)</td><td>Vidéo de test : gorgée et balancement</td></tr>
<tr><td><b>3. Animations</b></td><td>Repos de chaque stade, gestes, transitions</td><td>Vidéos par stade</td></tr>
<tr><td><b>4. Machine à états</b></td><td>Entrées du point 4 branchées</td><td>Test dans l'appli (intégration par nos soins)</td></tr>
<tr><td><b>5. Livraison</b></td><td>.riv, .rev, aperçus</td><td>Une série de retouches après intégration</td></tr>
<tr><td><b>Ensuite</b></td><td>Version femme avec le même squelette ; éventuellement la jauge alambic</td><td>Devis séparé</td></tr></table>
<p style="font-size:9pt">Demander deux ou trois devis (Malt, Fiverr, communauté Rive), avec un délai et le nombre de retouches compris. Les droits d'exploitation complets du personnage doivent être cédés (appli, boutiques d'applis, communication).</p>

<h2>10. Option : la jauge alambic</h2>
<p style="font-size:9pt">Plan de travail <code>Alambic</code> (160 × 160) : alambic en verre et cuivre qui se remplit de potion bleue. Entrées : <code>level</code> (Number 0 à 100), <code>pour</code> (Trigger : une goutte tombe dans le col, remous et léger rebond du niveau), <code>down</code> (Boolean : les bulles redescendent quand le taux baisse). Flamme qui grandit avec le niveau, vapeur au-delà de la moitié, gouttes au bout du serpentin.</p>

<h2>11. Intégration (de notre côté)</h2>
<ul style="font-size:9pt">
<li>L'appli charge <code>avatar.riv</code>, règle <code>stage</code> selon le taux, <code>glass</code> selon le dernier verre (s'il a moins de 25 min), <code>shirt</code> selon le joueur, et déclenche <code>sip</code> à chaque verre noté et <code>stageUp</code> à chaque changement de stade.</li>
<li>Tant que le fichier n'est pas livré, ou s'il ne se charge pas, l'avatar actuel (dessin en code) reste affiché.</li>
</ul>
<div class="foot"><span>Alamb’hic · Cahier des charges Rive</span><span>{D}</span></div></div>"""

write("rive.html", f"<style>{CSS}</style></head><body>{body}</body></html>", "Avatar animé : cahier des charges Rive")
