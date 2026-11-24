/* Alamb'hic — langues : français (langue source), anglais, espagnol, portugais.
   L'interface est écrite en français ; après chaque affichage, I18N.apply() remplace les textes connus (dictionnaire)
   et les phrases à trous (motifs). Un texte absent du dictionnaire reste en français.
   Pour ajouter une traduction : une ligne « français | anglais | espagnol | portugais » dans DICT. */
"use strict";
(function (root) {
  const DICT = `
On trinque, on se chambre, on se surveille.|Cheers, banter, and look out for each other.|Brindamos, nos picamos y nos cuidamos.|A gente brinda, zoa e se cuida.
Chacun note ses verres. Alamb'hic estime les taux, trace les courbes de tout le groupe et prévient les autres quand quelqu'un débloque un titre ou franchit un seuil.|Everyone logs their drinks. Alamb'hic estimates blood alcohol levels, draws the whole group's curves and tells the others when someone unlocks a title or crosses a threshold.|Cada uno anota sus copas. Alamb'hic estima las tasas, dibuja las curvas de todo el grupo y avisa a los demás cuando alguien desbloquea un título o cruza un umbral.|Cada um anota seus copos. O Alamb'hic estima as taxas, traça as curvas de todo o grupo e avisa os outros quando alguém desbloqueia um título ou passa de um limite.
Connexion|Log in|Iniciar sesión|Entrar
Créer un compte|Sign up|Crear una cuenta|Criar conta
E-mail|Email|Correo electrónico|E-mail
Mot de passe|Password|Contraseña|Senha
Mot de passe (8 caractères minimum)|Password (at least 8 characters)|Contraseña (mínimo 8 caracteres)|Senha (mínimo 8 caracteres)
Créer mon compte|Create my account|Crear mi cuenta|Criar minha conta
Me connecter|Log in|Entrar|Entrar
Mot de passe oublié ?|Forgot your password?|¿Olvidaste tu contraseña?|Esqueceu a senha?
Mot de passe oublié|Forgotten password|Contraseña olvidada|Senha esquecida
J'ai 18 ans ou plus, j'accepte les|I am 18 or older, I accept the|Tengo 18 años o más, acepto las|Tenho 18 anos ou mais, aceito os
conditions d'utilisation|terms of use|condiciones de uso|termos de uso
et le traitement de mes consommations décrit dans la|and the processing of my drinks described in the|y el tratamiento de mis consumos descrito en la|e o tratamento dos meus consumos descrito na
politique de confidentialité|privacy policy|política de privacidad|política de privacidade
En continuant avec Google, vous confirmez avoir 18 ans ou plus et acceptez les|By continuing with Google, you confirm you are 18 or older and accept the|Al continuar con Google, confirmas que tienes 18 años o más y aceptas las|Ao continuar com o Google, você confirma ter 18 anos ou mais e aceita os
conditions|terms|condiciones|termos
et la|and the|y la|e a
ou|or|o|ou
pour découvrir|to discover|para descubrir|para conhecer
Voir la démo : une soirée fictive en accéléré|Watch the demo: a fictional night, fast-forwarded|Ver la demo: una noche ficticia en cámara rápida|Ver a demo: uma noite fictícia acelerada
Réservé aux 18 ans et plus. Les taux affichés sont des estimations, jamais une autorisation de conduire.|For adults 18+ only. The levels shown are estimates, never a permission to drive.|Solo para mayores de 18 años. Las tasas son estimaciones, nunca una autorización para conducir.|Somente para maiores de 18 anos. As taxas são estimativas, nunca uma autorização para dirigir.
Confidentialité|Privacy|Privacidad|Privacidade
Conditions|Terms|Condiciones|Termos
Aide|Help|Ayuda|Ajuda
Démo|Demo|Demo|Demo
Amis|Friends|Amigos|Amigos
Profil|Profile|Perfil|Perfil
Moi|Me|Yo|Eu
Courbes|Curves|Curvas|Curvas
Potes|Mates|Colegas|Galera
Fil|Feed|Muro|Feed
Démo · soirée fictive|Demo · fictional night|Demo · noche ficticia|Demo · noite fictícia
Lecture|Play|Reproducir|Reproduzir
Pause|Pause|Pausa|Pausar
Quitter|Quit|Salir|Sair
Visite|Tour|Visita|Tour
Passer|Skip|Saltar|Pular
Suivant|Next|Siguiente|Próximo
Terminer|Finish|Terminar|Concluir
Mon profil|My profile|Mi perfil|Meu perfil
Votre profil|Your profile|Tu perfil|Seu perfil
Ces mesures servent au calcul de votre taux. Seuls votre pseudo, vos verres et vos taux sont visibles des autres joueurs.|These measurements are used to calculate your level. Only your nickname, drinks and levels are visible to other players.|Estas medidas sirven para calcular tu tasa. Solo tu apodo, tus copas y tus tasas son visibles para los demás.|Essas medidas servem para calcular sua taxa. Só seu apelido, seus copos e suas taxas ficam visíveis para os outros.
Pseudo|Nickname|Apodo|Apelido
Sexe biologique|Biological sex|Sexo biológico|Sexo biológico
Homme|Male|Hombre|Homem
Femme|Female|Mujer|Mulher
Âge|Age|Edad|Idade
Taille (cm)|Height (cm)|Altura (cm)|Altura (cm)
Poids (kg)|Weight (kg)|Peso (kg)|Peso (kg)
Plafond perso (g/L)|Personal limit (g/L)|Límite personal (g/L)|Limite pessoal (g/L)
Enregistrer|Save|Guardar|Salvar
Retour|Back|Volver|Voltar
Langue|Language|Idioma|Idioma
Documentation|Documentation|Documentación|Documentação
Voir la démo|Watch the demo|Ver la demo|Ver a demo
Banc de test (ordinateur)|Test bench (computer)|Banco de pruebas (ordenador)|Bancada de testes (computador)
Me déconnecter|Log out|Cerrar sesión|Sair da conta
Supprimer mon compte et toutes mes données|Delete my account and all my data|Eliminar mi cuenta y todos mis datos|Excluir minha conta e todos os meus dados
Tout sera effacé : profil, verres, titres.|Everything will be erased: profile, drinks, titles.|Se borrará todo: perfil, copas, títulos.|Tudo será apagado: perfil, copos, títulos.
Oui, tout supprimer|Yes, delete everything|Sí, borrar todo|Sim, apagar tudo
Annuler|Cancel|Cancelar|Cancelar
Mes 7 derniers jours|My last 7 days|Mis últimos 7 días|Meus últimos 7 dias
verres standard|standard drinks|copas estándar|doses padrão
Mes badges|My badges|Mis insignias|Minhas medalhas
Ils suivent votre historique et récompensent la régularité et la modération, jamais l'excès.|They follow your history and reward consistency and moderation, never excess.|Siguen tu historial y premian la constancia y la moderación, nunca el exceso.|Elas acompanham seu histórico e premiam a constância e a moderação, nunca o excesso.
L'Habitué|The Regular|El Habitual|O Habitué
Le Chameau d'or|The Golden Camel|El Camello de oro|O Camelo de ouro
Sam fidèle|Loyal Sam|Sam fiel|Sam fiel
Sans fausse note|Pitch Perfect|Sin una nota falsa|Sem nota errada
Pilote de ligne|Airline Pilot|Piloto de línea|Piloto de linha
Bande de potes|Band of Mates|Pandilla|Turma
Soirées jouées|Nights played|Noches jugadas|Noites jogadas
Verres d'eau notés|Glasses of water logged|Vasos de agua anotados|Copos de água anotados
Soirées en Sam|Nights as Sam|Noches como Sam|Noites como Sam
Soirées terminées sans titre de honte|Nights finished without a shame title|Noches terminadas sin título de vergüenza|Noites terminadas sem título de vergonha
Atterrissages en douceur|Soft landings|Aterrizajes suaves|Pousos suaves
Amis dans votre liste|Friends in your list|Amigos en tu lista|Amigos na sua lista
À débloquer|Locked|Por desbloquear|A desbloquear
Bronze|Bronze|Bronce|Bronze
Argent|Silver|Plata|Prata
Or|Gold|Oro|Ouro
Notifications|Notifications|Notificaciones|Notificações
Activées sur cet appareil|On for this device|Activadas en este dispositivo|Ativadas neste aparelho
Désactivées sur cet appareil|Off for this device|Desactivadas en este dispositivo|Desativadas neste aparelho
Activer sur cet appareil|Turn on for this device|Activar en este dispositivo|Ativar neste aparelho
Tester|Test|Probar|Testar
Couper|Turn off|Desactivar|Desligar
Alertes copains et alertes rouges des joueurs de la soirée|Friend alerts and red alerts from players tonight|Alertas de amigos y alertas rojas de los jugadores de la noche|Alertas da galera e alertas vermelhos dos jogadores da noite
Titres gagnés par les joueurs de la soirée|Titles won by players tonight|Títulos ganados por los jugadores de la noche|Títulos ganhos pelos jogadores da noite
Titres de vos amis dans leurs propres soirées|Your friends' titles at their own parties|Títulos de tus amigos en sus propias fiestas|Títulos dos seus amigos nas festas deles
Rappel « avez-vous mangé ? » à l'heure du déjeuner et du dîner|“Have you eaten?” reminder at lunch and dinner time|Recordatorio «¿has comido?» a la hora de comer y de cenar|Lembrete “você comeu?” no almoço e no jantar
Nouveaux badges (bronze, argent, or)|New badges (bronze, silver, gold)|Nuevas insignias (bronce, plata, oro)|Novas medalhas (bronze, prata, ouro)
Notifications activées|Notifications on|Notificaciones activadas|Notificações ativadas
Vous les recevrez même appli fermée.|You will get them even when the app is closed.|Las recibirás incluso con la app cerrada.|Você vai recebê-las mesmo com o app fechado.
Notifications coupées sur cet appareil|Notifications turned off on this device|Notificaciones desactivadas en este dispositivo|Notificações desligadas neste aparelho
Réglage enregistré|Setting saved|Ajuste guardado|Ajuste salvo
Réglage non enregistré|Setting not saved|Ajuste no guardado|Ajuste não salvo
Notification de test envoyée|Test notification sent|Notificación de prueba enviada|Notificação de teste enviada
Elle doit apparaître dans quelques secondes.|It should appear in a few seconds.|Debería aparecer en unos segundos.|Ela deve aparecer em alguns segundos.
Aucun appareil joignable|No reachable device|Ningún dispositivo disponible|Nenhum aparelho disponível
Réactivez les notifications.|Turn notifications back on.|Vuelve a activar las notificaciones.|Ative as notificações de novo.
Notifications refusées. Autorisez-les dans les réglages du navigateur pour ce site.|Notifications blocked. Allow them in your browser settings for this site.|Notificaciones rechazadas. Permítelas en los ajustes del navegador para este sitio.|Notificações recusadas. Permita-as nas configurações do navegador para este site.
Salut|Hi|Hola|Olá
Créez une soirée et partagez son code, ou rejoignez celle de vos amis.|Create a party and share its code, or join your friends' party.|Crea una fiesta y comparte su código, o únete a la de tus amigos.|Crie uma festa e compartilhe o código, ou entre na dos seus amigos.
Créer une soirée|Create a party|Crear una fiesta|Criar uma festa
Mes amis|My friends|Mis amigos|Meus amigos
Rejoindre avec un code|Join with a code|Unirse con un código|Entrar com um código
Rejoindre|Join|Unirse|Entrar
Ajouter un verre|Add a drink|Añadir una copa|Adicionar um copo
Sam boit de l'eau|Sam drinks water|Sam bebe agua|Sam bebe água
Bu|Drank|Bebido|Bebido
Maintenant|Now|Ahora|Agora
il y a 15 min|15 min ago|hace 15 min|há 15 min
Je suis Sam ce soir (zéro alcool)|I'm Sam tonight (zero alcohol)|Soy Sam esta noche (cero alcohol)|Sou o Sam hoje (zero álcool)
Volume (cl)|Volume (cl)|Volumen (cl)|Volume (cl)
Degré (%)|ABV (%)|Grado (%)|Teor (%)
Ajouter|Add|Añadir|Adicionar
Mes titres|My titles|Mis títulos|Meus títulos
Mes verres|My drinks|Mis copas|Meus copos
Touchez une boisson ci-dessus pour l'enregistrer. Pensez à l'eau : trois verres débloquent le Chameau.|Tap a drink above to log it. Don't forget water: three glasses unlock the Camel.|Toca una bebida arriba para anotarla. Piensa en el agua: tres vasos desbloquean el Camello.|Toque numa bebida acima para anotá-la. Lembre da água: três copos desbloqueiam o Camelo.
Bière|Beer|Cerveza|Cerveja
Pinte|Pint|Pinta|Caneca
Vin|Wine|Vino|Vinho
Champagne|Champagne|Champán|Champanhe
Shot|Shot|Chupito|Shot
Cocktail|Cocktail|Cóctel|Coquetel
Cidre|Cider|Sidra|Sidra
Eau|Water|Agua|Água
Verre perso|Custom drink|Copa personalizada|Copo personalizado
Sans alcool|Alcohol-free|Sin alcohol|Sem álcool
Sobre|Sober|Sobrio|Sóbrio
Pompette|Tipsy|Achispado|Alegrinho
Interdit de conduire|No driving|Prohibido conducir|Proibido dirigir
Au-dessus du plafond|Over the limit|Por encima del límite|Acima do limite
Alerte|Alert|Alerta|Alerta
En forme|Fresh|En forma|Em forma
Premier verre|First drink|Primera copa|Primeiro copo
Détendu|Relaxed|Relajado|Relaxado
Éméché|Merry|Alegre|Alto
Fou rire|Giggles|Ataque de risa|Crise de riso
Hilare|Hilarious|Desternillado|Às gargalhadas
Ça tourne|Spinning|Todo da vueltas|Tudo gira
Les étoiles|Seeing stars|Viendo estrellas|Vendo estrelas
KO|KO|KO|KO
Avant votre premier verre|Before your first drink|Antes de tu primera copa|Antes do seu primeiro copo
Qu'avez-vous mangé aujourd'hui ?|What have you eaten today?|¿Qué has comido hoy?|O que você comeu hoje?
Un repas ralentit le passage de l'alcool dans le sang et baisse le pic. Pour chaque repas pris, indiquez son type et son heure.|A meal slows alcohol absorption and lowers the peak. For each meal, give its type and time.|Una comida frena el paso del alcohol a la sangre y baja el pico. Para cada comida, indica su tipo y su hora.|Uma refeição desacelera a passagem do álcool para o sangue e baixa o pico. Para cada refeição, indique o tipo e a hora.
Petit-déjeuner|Breakfast|Desayuno|Café da manhã
Déjeuner|Lunch|Almuerzo|Almoço
Goûter|Afternoon snack|Merienda|Lanche
Dîner|Dinner|Cena|Jantar
Rien|Nothing|Nada|Nada
Valider mes repas|Confirm my meals|Confirmar mis comidas|Confirmar minhas refeições
Rien mangé|Ate nothing|No he comido nada|Não comi nada
Avez-vous dîné ?|Have you had dinner?|¿Has cenado?|Você jantou?
Avez-vous déjeuné ?|Have you had lunch?|¿Has almorzado?|Você almoçou?
Avez-vous mangé quelque chose ?|Have you eaten anything?|¿Has comido algo?|Você comeu alguma coisa?
Oui, à|Yes, at|Sí, a las|Sim, às
Valider|Confirm|Confirmar|Confirmar
Pas encore|Not yet|Todavía no|Ainda não
Je ne mangerai pas|I won't eat|No voy a comer|Não vou comer
Mes repas|My meals|Mis comidas|Minhas refeições
Ajouter un repas|Add a meal|Añadir una comida|Adicionar refeição
Aucun repas noté ces dernières 24 h : l'alcool est compté à jeun.|No meal logged in the last 24 h: alcohol is counted on an empty stomach.|Ninguna comida anotada en las últimas 24 h: el alcohol se cuenta en ayunas.|Nenhuma refeição anotada nas últimas 24 h: o álcool é contado em jejum.
Grignotage|Snack|Picoteo|Petisco
Repas léger|Light meal|Comida ligera|Refeição leve
Repas complet|Full meal|Comida completa|Refeição completa
Repas copieux|Big meal|Comida copiosa|Refeição farta
apéritif, encas|nibbles, snack|aperitivo, tentempié|aperitivo, lanchinho
salade, sandwich|salad, sandwich|ensalada, bocadillo|salada, sanduíche
plat, féculents|main course, starches|plato, féculas|prato, carboidratos
repas de fête|feast|comida de fiesta|refeição de festa
Indiquez d'abord vos repas du jour, juste au-dessus : ils changent beaucoup le calcul. L'eau reste disponible.|First enter today's meals, just above: they change the calculation a lot. Water is still available.|Indica primero tus comidas del día, justo arriba: cambian mucho el cálculo. El agua sigue disponible.|Primeiro informe suas refeições do dia, logo acima: elas mudam muito o cálculo. A água continua disponível.
Courbes de la soirée|Tonight's curves|Curvas de la noche|Curvas da noite
Les courbes apparaissent dès le premier verre d'alcool enregistré.|Curves appear as soon as the first alcoholic drink is logged.|Las curvas aparecen con la primera copa de alcohol anotada.|As curvas aparecem a partir do primeiro copo com álcool anotado.
maintenant|now|ahora|agora
Trait plein : taux estimé jusqu'à maintenant. Pointillés : redescente prévue si plus personne ne boit.|Solid line: estimated level until now. Dotted: expected decline if nobody drinks any more.|Línea continua: tasa estimada hasta ahora. Punteado: bajada prevista si nadie bebe más.|Linha cheia: taxa estimada até agora. Pontilhado: descida prevista se ninguém beber mais.
En direct|Live|En directo|Ao vivo
Points|Points|Puntos|Pontos
Mes potes en direct|My mates live|Mis colegas en directo|Minha galera ao vivo
Taux estimé et tendance sur les 15 dernières minutes : ▲ ça monte, ▼ ça redescend.|Estimated level and 15-minute trend: ▲ going up, ▼ coming down.|Tasa estimada y tendencia de los últimos 15 minutos: ▲ sube, ▼ baja.|Taxa estimada e tendência dos últimos 15 minutos: ▲ subindo, ▼ descendo.
stable|steady|estable|estável
(vous)|(you)|(tú)|(você)
Pas encore de titre|No title yet|Aún sin título|Ainda sem título
Classement des titres|Title ranking|Clasificación de títulos|Ranking de títulos
Titre gagné : +10. Titre de honte (plafond, Naufragé, Fusée) : −15. Rester raisonnable rapporte plus que grimper.|Title won: +10. Shame title (limit, Castaway, Rocket): −15. Staying sensible pays more than climbing.|Título ganado: +10. Título de vergüenza (límite, Náufrago, Cohete): −15. Ser sensato da más que subir.|Título ganho: +10. Título de vergonha (limite, Náufrago, Foguete): −15. Ser sensato rende mais do que subir.
Fil de la soirée|Tonight's feed|Muro de la noche|Feed da noite
Les titres et alertes de chacun s'affichent ici et en notification sur tous les téléphones de la soirée.|Everyone's titles and alerts show here and as notifications on every phone at the party.|Los títulos y alertas de cada uno aparecen aquí y como notificación en todos los móviles de la fiesta.|Os títulos e alertas de cada um aparecem aqui e como notificação em todos os celulares da festa.
Code de la soirée|Party code|Código de la fiesta|Código da festa
Copier l'invitation|Copy invitation|Copiar invitación|Copiar convite
Vos amis ouvrent Alamb'hic et entrent ce code.|Your friends open Alamb'hic and enter this code.|Tus amigos abren Alamb'hic e introducen este código.|Seus amigos abrem o Alamb'hic e digitam este código.
Partager la soirée|Share the party|Compartir la fiesta|Compartilhar a festa
Écran TV|TV screen|Pantalla de TV|Tela de TV
Les avatars, les courbes et les titres en grand, pour toute la salle.|Avatars, curves and titles on the big screen, for the whole room.|Avatares, curvas y títulos en grande, para toda la sala.|Avatares, curvas e títulos em tela grande, para a sala toda.
Sur la TV, ouvrez|On the TV, open|En la TV, abre|Na TV, abra
et tapez :|and type:|y escribe:|e digite:
Télécommande|Remote|Mando|Controle remoto
Auto|Auto|Auto|Auto
Avatars|Avatars|Avatares|Avatares
Récap à partager|Shareable recap|Resumen para compartir|Resumo para compartilhar
Une page publique avec les courbes, les avatars et les titres de la soirée.|A public page with tonight's curves, avatars and titles.|Una página pública con las curvas, los avatares y los títulos de la noche.|Uma página pública com as curvas, os avatares e os títulos da noite.
Créer le lien|Create link|Crear el enlace|Criar link
Partager le lien|Share link|Compartir el enlace|Compartilhar link
Apparaître dans le récap (pseudo seulement)|Appear in the recap (nickname only)|Aparecer en el resumen (solo el apodo)|Aparecer no resumo (só o apelido)
Supprimer le lien|Delete link|Eliminar el enlace|Excluir link
Lien du récap copié|Recap link copied|Enlace del resumen copiado|Link do resumo copiado
Lien du récap supprimé|Recap link deleted|Enlace del resumen eliminado|Link do resumo excluído
Il ne s'ouvre plus.|It no longer opens.|Ya no se abre.|Ele não abre mais.
Taux estimé par la formule de Widmark (eau corporelle de Watson). L'écart avec un éthylotest peut dépasser 0,2 g/L. Ce n'est jamais une autorisation de conduire : après avoir bu, on ne prend pas le volant.|Level estimated with the Widmark formula (Watson body water). The gap with a breathalyser can exceed 0.2 g/L. It is never a permission to drive: after drinking, don't drive.|Tasa estimada con la fórmula de Widmark (agua corporal de Watson). La diferencia con un alcoholímetro puede superar 0,2 g/L. Nunca es una autorización para conducir: si bebes, no conduzcas.|Taxa estimada pela fórmula de Widmark (água corporal de Watson). A diferença com um bafômetro pode passar de 0,2 g/L. Nunca é uma autorização para dirigir: se beber, não dirija.
Verre enregistré|Drink logged|Copa anotada|Copo anotado
Verre retiré|Drink removed|Copa retirada|Copo retirado
Verre supprimé|Drink deleted|Copa eliminada|Copo excluído
Verre non enregistré|Drink not logged|Copa no anotada|Copo não anotado
Verre incomplet|Incomplete drink|Copa incompleta|Copo incompleto
Repas enregistrés|Meals saved|Comidas guardadas|Refeições salvas
Repas ajouté|Meal added|Comida añadida|Refeição adicionada
Bon appétit|Enjoy your meal|Buen provecho|Bom apetite
Invitation copiée|Invitation copied|Invitación copiada|Convite copiado
Mes amis voient mon taux en direct pendant mes soirées|My friends see my live level during my parties|Mis amigos ven mi tasa en directo durante mis fiestas|Meus amigos veem minha taxa ao vivo nas minhas festas
Mon code ami|My friend code|Mi código de amigo|Meu código de amigo
Partager mon lien|Share my link|Compartir mi enlace|Compartilhar meu link
Ajouter un ami avec son code|Add a friend with their code|Añadir un amigo con su código|Adicionar um amigo pelo código
Demandes reçues|Requests received|Solicitudes recibidas|Pedidos recebidos
Accepter|Accept|Aceptar|Aceitar
Refuser|Decline|Rechazar|Recusar
veut vous ajouter|wants to add you|quiere añadirte|quer adicionar você
En soirée|At a party|De fiesta|Na festa
Les autres|The others|Los demás|Os outros
En attente|Pending|Pendiente|Pendente
n'a pas encore accepté|hasn't accepted yet|aún no ha aceptado|ainda não aceitou
Retirer|Remove|Quitar|Remover
Pas en soirée|Not at a party|No está de fiesta|Fora da festa
Ne partage pas son taux|Doesn't share their level|No comparte su tasa|Não compartilha a taxa
Leur taux en direct quand ils sont en soirée, leur avatar, leur tendance et leur dernier titre.|Their live level when they're partying, their avatar, their trend and their latest title.|Su tasa en directo cuando están de fiesta, su avatar, su tendencia y su último título.|A taxa ao vivo quando estão na festa, o avatar, a tendência e o último título.
Aucun ami en soirée pour l'instant. Leur taux apparaîtra ici dès qu'ils rejoindront une soirée.|No friends at a party right now. Their level will show here as soon as they join one.|Ningún amigo de fiesta por ahora. Su tasa aparecerá aquí en cuanto se unan a una.|Nenhum amigo na festa agora. A taxa vai aparecer aqui assim que entrarem numa.
Pas encore d'amis. Partagez votre lien ou demandez leur code à vos potes.|No friends yet. Share your link or ask your mates for their code.|Aún no tienes amigos. Comparte tu enlace o pide su código a tus colegas.|Ainda sem amigos. Compartilhe seu link ou peça o código à galera.
Questions fréquentes|Frequently asked questions|Preguntas frecuentes|Perguntas frequentes
Posez votre question ou parcourez les réponses.|Ask your question or browse the answers.|Haz tu pregunta o consulta las respuestas.|Faça sua pergunta ou veja as respostas.
Demander|Ask|Preguntar|Perguntar
Réponse|Answer|Respuesta|Resposta
Réponse (assistant)|Answer (assistant)|Respuesta (asistente)|Resposta (assistente)
Entrez l'adresse de votre compte : nous vous envoyons un lien pour choisir un nouveau mot de passe (valable 1 heure).|Enter your account email: we'll send you a link to choose a new password (valid for 1 hour).|Introduce el correo de tu cuenta: te enviamos un enlace para elegir una nueva contraseña (válido 1 hora).|Digite o e-mail da sua conta: enviaremos um link para escolher uma nova senha (válido por 1 hora).
Recevoir le lien|Send me the link|Recibir el enlace|Receber o link
Retour à la connexion|Back to login|Volver al inicio de sesión|Voltar ao login
E-mail envoyé|Email sent|Correo enviado|E-mail enviado
Si un compte existe avec cette adresse, le lien arrive dans quelques instants. Pensez à regarder dans les indésirables.|If an account exists with this email, the link will arrive shortly. Check your spam folder.|Si existe una cuenta con este correo, el enlace llegará en unos instantes. Revisa el correo no deseado.|Se existir uma conta com este e-mail, o link chega em instantes. Confira o spam.
Nouveau mot de passe|New password|Nueva contraseña|Nova senha
Nouveau mot de passe (8 caractères minimum)|New password (at least 8 characters)|Nueva contraseña (mínimo 8 caracteres)|Nova senha (mínimo 8 caracteres)
Enregistrer et me connecter|Save and log in|Guardar y entrar|Salvar e entrar
Mot de passe changé|Password changed|Contraseña cambiada|Senha alterada
Vous êtes connecté.|You are logged in.|Has iniciado sesión.|Você está conectado.
Votre avatar, la jauge alambic et votre taux estimé : ils évoluent en direct à chaque verre et à chaque repas.|Your avatar, the still gauge and your estimated level: they change live with every drink and every meal.|Tu avatar, el indicador alambique y tu tasa estimada: cambian en directo con cada copa y cada comida.|Seu avatar, o medidor alambique e sua taxa estimada: mudam ao vivo a cada copo e a cada refeição.
Touchez une boisson pour l'enregistrer. L'eau compte aussi : trois verres d'eau débloquent le Chameau.|Tap a drink to log it. Water counts too: three glasses of water unlock the Camel.|Toca una bebida para anotarla. El agua también cuenta: tres vasos de agua desbloquean el Camello.|Toque numa bebida para anotá-la. A água também conta: três copos de água desbloqueiam o Camelo.
Faites avancer la soirée avec ce curseur, ou touchez « Lecture » : les titres tombent et les avatars changent.|Move the night forward with this slider, or tap “Play”: titles drop and avatars change.|Avanza la noche con este cursor, o toca «Reproducir»: caen los títulos y cambian los avatares.|Avance a noite com este controle, ou toque em “Reproduzir”: os títulos caem e os avatares mudam.
Courbes : tout le groupe sur un même graphique. Potes : taux en direct et tendance façon bourse.|Curves: the whole group on one chart. Mates: live levels and stock-market-style trends.|Curvas: todo el grupo en un mismo gráfico. Colegas: tasas en directo y tendencia estilo bolsa.|Curvas: o grupo todo num só gráfico. Galera: taxas ao vivo e tendência estilo bolsa.
Le fil garde tous les titres et les alertes de la soirée. Amusez-vous bien, et on ne conduit pas après avoir bu !|The feed keeps all of tonight's titles and alerts. Have fun, and don't drive after drinking!|El muro guarda todos los títulos y alertas de la noche. ¡Diviértete, y si bebes no conduzcas!|O feed guarda todos os títulos e alertas da noite. Divirta-se, e se beber não dirija!
Sam de la soirée|Tonight's Sam|El Sam de la noche|O Sam da noite
Premières bulles|First Bubbles|Primeras burbujas|Primeiras bolhas
Joues roses|Rosy Cheeks|Mejillas sonrosadas|Bochechas rosadas
Clés confisquées|Keys Confiscated|Llaves confiscadas|Chaves confiscadas
Philosophe de comptoir|Bar-Stool Philosopher|Filósofo de barra|Filósofo de boteco
Hors plafond|Over the Limit|Fuera de límite|Acima do limite
La Fusée|The Rocket|El Cohete|O Foguete
Le Naufragé|The Castaway|El Náufrago|O Náufrago
Alerte copains|Friend Alert|Alerta de amigos|Alerta da galera
Alerte rouge|Red Alert|Alerta roja|Alerta vermelho
Atterrissage en douceur|Soft Landing|Aterrizaje suave|Pouso suave
Retour sur Terre|Back on Earth|De vuelta a la Tierra|De volta à Terra
Le Chameau|The Camel|El Camello|O Camelo
L'Oasis|The Oasis|El Oasis|O Oásis
Verre supprimé|Drink deleted|Copa eliminada|Copo excluído
Fermer|Close|Cerrar|Fechar
Heure du repas|Meal time|Hora de la comida|Hora da refeição
Supprimer ce verre|Delete this drink|Eliminar esta copa|Excluir este copo
Supprimer ce repas|Delete this meal|Eliminar esta comida|Excluir esta refeição
Ex. pourquoi mon pic baisse après un repas ?|E.g. why does my peak drop after a meal?|Ej.: ¿por qué baja mi pico tras una comida?|Ex.: por que meu pico cai depois de uma refeição?
Le code de soirée fait 4 lettres.|The party code has 4 letters.|El código de la fiesta tiene 4 letras.|O código da festa tem 4 letras.
Indiquez l'heure du repas.|Enter the meal time.|Indica la hora de la comida.|Informe a hora da refeição.
Cette heure n'est pas encore passée.|That time hasn't come yet.|Esa hora aún no ha llegado.|Esse horário ainda não chegou.
E-mail ou mot de passe incorrect.|Wrong email or password.|Correo o contraseña incorrectos.|E-mail ou senha incorretos.
Connectez-vous pour continuer.|Log in to continue.|Inicia sesión para continuar.|Entre para continuar.
Aucune soirée avec ce code. Vérifiez les 4 lettres.|No party with this code. Check the 4 letters.|No hay ninguna fiesta con este código. Revisa las 4 letras.|Nenhuma festa com este código. Confira as 4 letras.
Adresse e-mail invalide.|Invalid email address.|Correo no válido.|E-mail inválido.
Le mot de passe doit faire au moins 8 caractères.|Password must be at least 8 characters.|La contraseña debe tener al menos 8 caracteres.|A senha deve ter pelo menos 8 caracteres.
Chargement…|Loading…|Cargando…|Carregando…
Chargement de la soirée…|Loading the party…|Cargando la fiesta…|Carregando a festa…
Afficher la soirée|Show the party|Mostrar la fiesta|Mostrar a festa
Sur un téléphone de la soirée : écran Moi → « Écran TV ». Tapez ici le code à 6 caractères qui s'affiche.|On a phone at the party: Me screen → “TV screen”. Type here the 6-character code it shows.|En un móvil de la fiesta: pantalla Yo → «Pantalla de TV». Escribe aquí el código de 6 caracteres que aparece.|Num celular da festa: tela Eu → “Tela de TV”. Digite aqui o código de 6 caracteres que aparece.
Taux estimés, jamais une autorisation de conduire. Après avoir bu, on ne prend pas le volant.|Estimated levels, never a permission to drive. After drinking, don't drive.|Tasas estimadas, nunca una autorización para conducir. Si bebes, no conduzcas.|Taxas estimadas, nunca uma autorização para dirigir. Se beber, não dirija.
Personne dans la soirée pour l'instant.|Nobody at the party yet.|Todavía no hay nadie en la fiesta.|Ninguém na festa por enquanto.
Les courbes apparaissent dès le premier verre d'alcool.|Curves appear from the first alcoholic drink.|Las curvas aparecen con la primera copa de alcohol.|As curvas aparecem a partir do primeiro copo com álcool.
Les titres de la soirée s'afficheront ici.|Tonight's titles will show here.|Los títulos de la noche aparecerán aquí.|Os títulos da noite vão aparecer aqui.
Connexion perdue, nouvel essai…|Connection lost, retrying…|Conexión perdida, reintentando…|Conexão perdida, tentando de novo…
Le code TV fait 6 caractères.|The TV code has 6 characters.|El código de TV tiene 6 caracteres.|O código da TV tem 6 caracteres.
Code TV inconnu ou expiré. Demandez-en un nouveau sur un téléphone de la soirée.|Unknown or expired TV code. Ask for a new one on a phone at the party.|Código de TV desconocido o caducado. Pide uno nuevo en un móvil de la fiesta.|Código de TV desconhecido ou expirado. Peça um novo num celular da festa.
Récap de soirée|Party recap|Resumen de la fiesta|Resumo da festa
Les joueurs|The players|Los jugadores|Os jogadores
Les courbes de la soirée|The night's curves|Las curvas de la noche|As curvas da noite
Le fil des titres|Title feed|El muro de títulos|O feed de títulos
Aucun titre cette fois.|No titles this time.|Ningún título esta vez.|Nenhum título desta vez.
Créer votre soirée sur Alamb'hic|Create your party on Alamb'hic|Crea tu fiesta en Alamb'hic|Crie sua festa no Alamb'hic
Découvrir Alamb'hic|Discover Alamb'hic|Descubre Alamb'hic|Conheça o Alamb'hic
Ce récapitulatif n'existe plus.|This recap no longer exists.|Este resumen ya no existe.|Este resumo não existe mais.
Aucun joueur n'a choisi d'apparaître dans ce récap.|No player chose to appear in this recap.|Ningún jugador ha elegido aparecer en este resumen.|Nenhum jogador escolheu aparecer neste resumo.
Avatars montrés au pic de chacun. Taux estimés par la formule de Widmark : jamais une autorisation de conduire. Seuls les joueurs qui l'ont accepté apparaissent ici, avec leur pseudo uniquement.|Avatars shown at each player's peak. Levels estimated with the Widmark formula: never a permission to drive. Only players who agreed appear here, with their nickname only.|Avatares mostrados en el pico de cada uno. Tasas estimadas con la fórmula de Widmark: nunca una autorización para conducir. Solo aparecen los jugadores que lo aceptaron, con su apodo.|Avatares mostrados no pico de cada um. Taxas estimadas pela fórmula de Widmark: nunca uma autorização para dirigir. Só aparecem os jogadores que aceitaram, com o apelido.
L'envoi d'e-mails n'est pas encore activé. Écrivez-nous depuis la page Confidentialité.|Email sending isn't active yet. Write to us from the Privacy page.|El envío de correos aún no está activado. Escríbenos desde la página de Privacidad.|O envio de e-mails ainda não está ativo. Escreva para nós pela página de Privacidade.
Ce lien a expiré ou a déjà servi. Refaites une demande.|This link has expired or was already used. Ask again.|Este enlace ha caducado o ya se usó. Vuelve a pedirlo.|Este link expirou ou já foi usado. Peça de novo.
Ce pseudo n'est pas accepté : choisissez-en un autre.|This nickname isn't allowed: choose another one.|Este apodo no está permitido: elige otro.|Este apelido não é aceito: escolha outro.
Un pseudo ne peut pas contenir d'adresse, de numéro ni de lien.|A nickname can't contain an address, a number or a link.|Un apodo no puede contener una dirección, un número ni un enlace.|Um apelido não pode conter endereço, número nem link.
Partager|Share|Compartir|Compartilhar
Sessions|Sessions|Sesiones|Sessões
Agenda|Calendar|Agenda|Agenda
Groupes|Groups|Grupos|Grupos
Soirées|Parties|Fiestas|Festas
Mes sessions|My sessions|Mis sesiones|Minhas sessões
Une session commence au premier verre d'alcool et se termine quand le taux revient à 0. 60 derniers jours.|A session starts with the first alcoholic drink and ends when your level is back to 0. Last 60 days.|Una sesión empieza con la primera copa de alcohol y termina cuando la tasa vuelve a 0. Últimos 60 días.|Uma sessão começa no primeiro copo com álcool e termina quando a taxa volta a 0. Últimos 60 dias.
Aucune session pour l'instant. Elles apparaîtront ici dès votre premier verre d'alcool.|No sessions yet. They will appear here from your first alcoholic drink.|Aún no hay sesiones. Aparecerán aquí con tu primera copa de alcohol.|Ainda sem sessões. Elas vão aparecer aqui a partir do seu primeiro copo com álcool.
‹ Toutes les sessions|‹ All sessions|‹ Todas las sesiones|‹ Todas as sessões
Début|Start|Inicio|Início
Fin|End|Fin|Fim
Retour à 0|Back to 0|Vuelta a 0|Volta a 0
Retour à 0 prévu|Expected back to 0|Vuelta a 0 prevista|Volta a 0 prevista
Pic|Peak|Pico|Pico
Verres d'alcool|Alcoholic drinks|Copas de alcohol|Copos com álcool
Verres d'eau|Glasses of water|Vasos de agua|Copos de água
Courbe de la session|Session curve|Curva de la sesión|Curva da sessão
Verres de la session|Drinks in this session|Copas de la sesión|Copos da sessão
Ma session en cours|My current session|Mi sesión en curso|Minha sessão atual
La session a commencé à votre premier verre d'alcool ; elle se terminera quand votre taux sera revenu à 0.|The session started with your first alcoholic drink; it will end when your level is back to 0.|La sesión empezó con tu primera copa de alcohol; terminará cuando tu tasa vuelva a 0.|A sessão começou no seu primeiro copo com álcool; vai terminar quando sua taxa voltar a 0.
Du premier verre au retour à 0.|From the first drink to back to 0.|De la primera copa a la vuelta a 0.|Do primeiro copo à volta a 0.
en cours|ongoing|en curso|em andamento
Soirée en cours|Party in progress|Fiesta en curso|Festa em andamento
Vos verres comptent aussi dans cette soirée.|Your drinks also count in this party.|Tus copas también cuentan en esta fiesta.|Seus copos também contam nesta festa.
Ouvrir|Open|Abrir|Abrir
Ce mois-ci|This month|Este mes|Este mês
Jours avec alcool|Days with alcohol|Días con alcohol|Dias com álcool
Jours sans alcool|Alcohol-free days|Días sin alcohol|Dias sem álcool
Jours à 6 et +|Days with 6+|Días con 6 o más|Dias com 6 ou mais
verres standard par jour|standard drinks per day|copas estándar por día|doses padrão por dia
Jour sans alcool.|Alcohol-free day.|Día sin alcohol.|Dia sem álcool.
Voir les sessions|See sessions|Ver las sesiones|Ver as sessões
Voir mon agenda|See my calendar|Ver mi agenda|Ver minha agenda
Prenez soin de vous|Take care of yourself|Cuídate|Cuide-se
Un œil sur votre conso|Keep an eye on your drinking|Ojo con tu consumo|De olho no seu consumo
Dans les repères|Within the guidelines|Dentro de las referencias|Dentro das referências
Mes groupes de potes|My groups of mates|Mis grupos de colegas|Meus grupos da galera
Les membres d'un groupe voient les courbes de tout le monde, quel que soit l'endroit où chacun boit, par créneaux de 48 h. Quitter le groupe arrête le partage.|Group members see everyone's curves, wherever each person drinks, in 48-hour windows. Leaving the group stops sharing.|Los miembros de un grupo ven las curvas de todos, beba donde beba cada uno, en franjas de 48 h. Salir del grupo detiene el intercambio.|Os membros de um grupo veem as curvas de todos, onde quer que cada um beba, em janelas de 48 h. Sair do grupo encerra o compartilhamento.
Aucun groupe pour l'instant.|No groups yet.|Aún no hay grupos.|Ainda sem grupos.
Nouveau groupe|New group|Nuevo grupo|Novo grupo
Créer|Create|Crear|Criar
‹ Mes groupes|‹ My groups|‹ Mis grupos|‹ Meus grupos
Les courbes du groupe|The group's curves|Las curvas del grupo|As curvas do grupo
Chaque membre, où qu'il boive. Nombre de verres standard sur les 48 h.|Every member, wherever they drink. Number of standard drinks over the 48 hours.|Cada miembro, beba donde beba. Número de copas estándar en las 48 h.|Cada membro, onde quer que beba. Número de doses padrão nas 48 h.
Inviter dans le groupe|Invite to the group|Invitar al grupo|Convidar para o grupo
Quitter le groupe|Leave the group|Salir del grupo|Sair do grupo
Quitter ce groupe ?|Leave this group?|¿Salir de este grupo?|Sair deste grupo?
Les autres ne verront plus vos courbes.|The others will no longer see your curves.|Los demás ya no verán tus curvas.|Os outros não vão mais ver suas curvas.
Oui, quitter|Yes, leave|Sí, salir|Sim, sair
Groupe créé|Group created|Grupo creado|Grupo criado
Groupe rejoint|Group joined|Te has unido al grupo|Você entrou no grupo
Mes soirées|My parties|Mis fiestas|Minhas festas
Aucune soirée en cours ou à venir.|No party in progress or coming up.|Ninguna fiesta en curso o próxima.|Nenhuma festa em andamento ou por vir.
Un code de 4 lettres à partager ; la courbe de la soirée va du début à la fin prévus.|A 4-letter code to share; the party curve runs from the planned start to the planned end.|Un código de 4 letras para compartir; la curva de la fiesta va del inicio al final previstos.|Um código de 4 letras para compartilhar; a curva da festa vai do início ao fim previstos.
Nom (facultatif)|Name (optional)|Nombre (opcional)|Nome (opcional)
Créer la soirée|Create the party|Crear la fiesta|Criar a festa
Soirées passées|Past parties|Fiestas pasadas|Festas passadas
à venir|upcoming|próxima|em breve
terminée|finished|terminada|terminada
Aller à l'accueil|Go to home|Ir al inicio|Ir para o início
Vos verres se notent maintenant depuis l'accueil (onglet Moi).|Your drinks are now logged from home (Me tab).|Tus copas se anotan ahora desde el inicio (pestaña Yo).|Seus copos agora são anotados no início (aba Eu).
Titre actuel, visible par vos potes|Current title, visible to your mates|Título actual, visible para tus colegas|Título atual, visível para a galera
Frise des taux|Level timeline|Línea de tasas|Linha das taxas
Les membres|Members|Los miembros|Os membros
Les membres en ce moment|Members right now|Los miembros ahora|Os membros agora
Chaque membre, où qu'il boive. Trait plein : jusqu'à maintenant ; pointillés : redescente prévue.|Every member, wherever they drink. Solid: until now; dotted: expected decline.|Cada miembro, beba donde beba. Continuo: hasta ahora; punteado: bajada prevista.|Cada membro, onde quer que beba. Contínuo: até agora; pontilhado: descida prevista.
Vue entière|Full view|Vista completa|Visão completa
Expressions des potes (« Max remet le facteur sur le vélo »)|Friends' expressions ("Max is back on the sauce")|Expresiones de los amigos («Max vuelve a las andadas»)|Expressões dos amigos («Max voltou à pinga»)
Amis et groupes|Friends and groups|Amigos y grupos|Amigos e grupos
Amis seulement|Friends only|Solo amigos|Só amigos
Groupes seulement|Groups only|Solo grupos|Só grupos
Rien|Nothing|Nada|Nada
`;
  const MAP = {}; const L = { en: 0, es: 1, pt: 2 };
  DICT.trim().split("\n").forEach(l => { const p = l.split("|"); if (p.length === 4) MAP[p[0].trim()] = p.slice(1).map(x => x.trim()); });
  const T = (fr, lang) => { const r = MAP[fr]; return r ? r[L[lang]] : null; };
  const tr = (fr, lang) => T(fr, lang) || fr;
  /* phrases à trous : [motif, anglais, espagnol, portugais] ; $1, $2… reprennent les morceaux ; {t:$1} traduit un morceau */
  const PAT = [
    [/^Salut (.+) !$/, "Hi $1!", "¡Hola, $1!", "Olá, $1!"],
    [/^(.+) · taux estimé$/, "$1 · estimated level", "$1 · tasa estimada", "$1 · taxa estimada"],
    [/^Pic ([\d,]+) à (\S+) · ([\d,]+) verres standard · retour à 0 vers (\S+)\. Plafond perso : ([\d,]+) g\/L\.$/, "Peak $1 at $2 · $3 standard drinks · back to 0 around $4. Personal limit: $5 g/L.", "Pico $1 a las $2 · $3 copas estándar · vuelta a 0 hacia las $4. Límite personal: $5 g/L.", "Pico $1 às $2 · $3 doses padrão · volta a 0 por volta das $4. Limite pessoal: $5 g/L."],
    [/^Pic ([\d,]+) à (\S+) · ([\d,]+) verres standard\. Plafond perso : ([\d,]+) g\/L\.$/, "Peak $1 at $2 · $3 standard drinks. Personal limit: $4 g/L.", "Pico $1 a las $2 · $3 copas estándar. Límite personal: $4 g/L.", "Pico $1 às $2 · $3 doses padrão. Limite pessoal: $4 g/L."],
    [/^Aucun verre d'alcool pour l'instant\. Plafond perso : ([\d,]+) g\/L\.$/, "No alcoholic drink yet. Personal limit: $1 g/L.", "Ninguna copa de alcohol por ahora. Límite personal: $1 g/L.", "Nenhum copo com álcool por enquanto. Limite pessoal: $1 g/L."],
    [/^Visite (\d+) \/ (\d+)$/, "Tour $1 / $2", "Visita $1 / $2", "Tour $1 / $2"],
    [/^Il est (\S+)$/, "It's $1", "Son las $1", "São $1"],
    [/^Badge (\S+) : (.+)$/, "{t:$1} badge: {t:$2}", "Insignia {t:$1}: {t:$2}", "Medalha {t:$1}: {t:$2}"],
    [/^(.+) : (\d+)\.?$/, "{t:$1}: $2", "{t:$1}: $2", "{t:$1}: $2"],
    [/^(À débloquer|Bronze|Argent|Or) · prochain palier à (\d+)$/, "{t:$1} · next level at $2", "{t:$1} · siguiente nivel en $2", "{t:$1} · próximo nível em $2"],
    [/^(Bronze|Argent|Or) · palier maximal$/, "{t:$1} · top level", "{t:$1} · nivel máximo", "{t:$1} · nível máximo"],
    [/^(au-dessus du|sous le) repère de 10$/, m => m[1] === "sous le" ? "under the guideline of 10" : "over the guideline of 10", m => m[1] === "sous le" ? "por debajo de la referencia de 10" : "por encima de la referencia de 10", m => m[1] === "sous le" ? "abaixo da referência de 10" : "acima da referência de 10"],
    [/^(\d+) jours? sans alcool\. Repères de Santé publique France : 10 verres par semaine au plus, 2 par jour, et des jours sans alcool\.$/, "$1 alcohol-free day(s). French public health guidelines: at most 10 drinks a week, 2 a day, and alcohol-free days.", "$1 día(s) sin alcohol. Referencias de la sanidad pública francesa: 10 copas por semana como máximo, 2 al día, y días sin alcohol.", "$1 dia(s) sem álcool. Referências da saúde pública francesa: no máximo 10 doses por semana, 2 por dia, e dias sem álcool."],
    [/^(.+) décolle doucement\.$/, "$1 is slowly taking off.", "$1 despega poco a poco.", "$1 está decolando devagar."],
    [/^(.+) commence à rosir\.$/, "$1 is starting to blush.", "$1 empieza a sonrojarse.", "$1 começa a corar."],
    [/^(.+) passe 0,5 g\/L : plus de volant ce soir\.$/, "$1 is over 0.5 g/L: no driving tonight.", "$1 pasa de 0,5 g/L: nada de volante esta noche.", "$1 passou de 0,5 g/L: nada de volante hoje."],
    [/^(.+) refait le monde à 0,8 g\/L\. Dernier titre à gagner en montant\.$/, "$1 is putting the world to rights at 0.8 g/L. Last title to win on the way up.", "$1 arregla el mundo a 0,8 g/L. Último título que se gana subiendo.", "$1 está consertando o mundo a 0,8 g/L. Último título a ganhar subindo."],
    [/^(.+) dépasse 1,2 g\/L\. Passage à l'eau\.$/, "$1 is over 1.2 g/L. Switching to water.", "$1 pasa de 1,2 g/L. Toca agua.", "$1 passou de 1,2 g/L. Hora da água."],
    [/^(.+) est estimé à 1,5 g\/L\. Apportez-lui de l'eau et gardez un œil sur lui\.$/, "$1 is estimated at 1.5 g/L. Bring them water and keep an eye on them.", "$1 está estimado en 1,5 g/L. Llévale agua y no le quites ojo.", "$1 está estimado em 1,5 g/L. Leve água e fique de olho."],
    [/^(.+) dépasse 2 g\/L estimé\. Restez avec lui\. S'il vomit, ne répond plus ou respire mal : appelez le 15\.$/, "$1 is over an estimated 2 g/L. Stay with them. If they vomit, stop responding or breathe badly: call emergency services (112).", "$1 pasa de 2 g/L estimados. Quédate con él. Si vomita, no responde o respira mal: llama al 112.", "$1 passou de 2 g/L estimados. Fique com ele. Se vomitar, não responder ou respirar mal: ligue para a emergência (112)."],
    [/^(.+) dépasse son plafond de ([\d,]+) g\/L\. Eau jusqu'à nouvel ordre\.$/, "$1 is over their $2 g/L limit. Water until further notice.", "$1 pasa su límite de $2 g/L. Agua hasta nueva orden.", "$1 passou do limite de $2 g/L. Água até segunda ordem."],
    [/^(.+) a pris \+0,5 g\/L en une heure\.$/, "$1 went up 0.5 g/L in one hour.", "$1 ha subido 0,5 g/L en una hora.", "$1 subiu 0,5 g/L em uma hora."],
    [/^(.+) redescend sous 0,2 g\/L\.$/, "$1 is back under 0.2 g/L.", "$1 vuelve a bajar de 0,2 g/L.", "$1 voltou para menos de 0,2 g/L."],
    [/^(.+) est revenu à zéro\.$/, "$1 is back to zero.", "$1 ha vuelto a cero.", "$1 voltou ao zero."],
    [/^(.+) a bu 3 verres d'eau\.$/, "$1 drank 3 glasses of water.", "$1 ha bebido 3 vasos de agua.", "$1 bebeu 3 copos de água."],
    [/^(.+) en est à 6 verres d'eau\.$/, "$1 is up to 6 glasses of water.", "$1 va por 6 vasos de agua.", "$1 já está em 6 copos de água."],
    [/^(.+) reste à zéro et veille sur tout le monde\.$/, "$1 stays at zero and looks after everyone.", "$1 se queda a cero y cuida de todos.", "$1 fica no zero e cuida de todo mundo."],
    [/^Titres de la session \((\d+)\)$/, "Session titles ($1)", "Títulos de la sesión ($1)", "Títulos da sessão ($1)"],
    [/^(.+) Pincez pour zoomer, glissez pour vous déplacer\.$/, "{t:$1} Pinch to zoom, swipe to move.", "{t:$1} Pellizca para ampliar, desliza para moverte.", "{t:$1} Faça pinça para ampliar, deslize para mover."],
    [/^Notre soirée du (.+)$/, "Our night: $1", "Nuestra noche del $1", "Nossa noite de $1"],
    [/^(\d+) joueurs? · (\d+) titres? débloqués?$/, "$1 player(s) · $2 title(s) unlocked", "$1 jugador(es) · $2 título(s) desbloqueado(s)", "$1 jogador(es) · $2 título(s) desbloqueado(s)"],
    [/^Pic ([\d,]+) g\/L( · Sam)?$/, "Peak $1 g/L$2", "Pico $1 g/L$2", "Pico $1 g/L$2"],
    [/^· pic ([\d,]+)$/, "· peak $1", "· pico $1", "· pico $1"],
    [/^(.+) · (\d\d:\d\d)$/, "{t:$1} · $2", "{t:$1} · $2", "{t:$1} · $2"],
  ];
  const fill = (out, m, lang) => typeof out === "function" ? out(m) : out.replace(/\{t:\$(\d)\}/g, (_, i) => tr(m[i], lang)).replace(/\$(\d)/g, (_, i) => m[i]);
  function t(s, lang) {
    lang = lang || I18N.lang; if (lang === "fr" || !s) return s;
    const k = s.trim(); if (!k) return s;
    let r = T(k, lang);
    if (!r) for (const p of PAT) { const m = k.match(p[0]); if (m) { const o = fill(p[1 + L[lang]], m, lang); if (o !== k) { r = o; break; } } }
    return r ? s.replace(k, r) : s;
  }
  const ORIG = new WeakMap();   // texte français d'origine de chaque nœud, pour pouvoir changer de langue sans recharger
  function apply(rootEl) {
    if (!rootEl) return;
    const w = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentNode && /^(SCRIPT|STYLE)$/.test(n.parentNode.nodeName) || n.parentNode.closest && n.parentNode.closest("[data-noi18n]") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
    for (const n of nodes) { if (!ORIG.has(n)) ORIG.set(n, n.nodeValue); const v = t(ORIG.get(n)); if (v !== n.nodeValue) n.nodeValue = v; }
    rootEl.querySelectorAll && rootEl.querySelectorAll("[placeholder],[aria-label],[title]").forEach(e => {
      for (const a of ["placeholder", "aria-label", "title"]) { const v = e.getAttribute(a); if (!v) continue; const k = "data-fr-" + a; if (!e.hasAttribute(k)) e.setAttribute(k, v); const x = t(e.getAttribute(k)); if (x !== v) e.setAttribute(a, x); }
    });
  }
  const pick = () => { let l = null; try { l = JSON.parse(localStorage.getItem("yd_lang")); } catch (e) {} if (!l) l = String((navigator.languages && navigator.languages[0]) || navigator.language || "fr").slice(0, 2).toLowerCase(); return ["fr", "en", "es", "pt"].includes(l) ? l : "en"; };
  const I18N = {
    lang: "fr", t, apply,
    set(l) { if (!["fr", "en", "es", "pt"].includes(l)) return; I18N.lang = l; try { localStorage.setItem("yd_lang", JSON.stringify(l)); } catch (e) {} document.documentElement.lang = l; if (typeof document !== "undefined") { apply(document.querySelector("header")); apply(document.querySelector("nav")); apply(document.querySelector("#demoBar")); } },
  };
  I18N.lang = typeof navigator !== "undefined" ? pick() : "fr";
  if (typeof document !== "undefined") { document.documentElement.lang = I18N.lang; document.addEventListener("DOMContentLoaded", () => { apply(document.querySelector("header")); apply(document.querySelector("nav")); apply(document.querySelector("#demoBar")); }); }
  root.I18N = I18N;
})(typeof self !== "undefined" ? self : this);
