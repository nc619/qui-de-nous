# Questions — Qui de nous ?

Ce fichier contient toutes les questions intégrées. Le serveur le lit à chaque démarrage.

**Comment le modifier**
- Chaque set commence par `## emoji Nom`. Ajoute `· 18+` à la fin du titre pour un set spicy.
- La ligne `<!-- id: ... -->` sert à reconnaître le set : ne la change pas. Pour un nouveau set, invente un id court sans espaces (ex. `<!-- id: vacances -->`).
- La ligne `> ...` est la description du set.
- Une question par ligne, qui commence par `- `. Les stats sont entre backticks à la fin : `chaos`, `hot`, `cerveau`, `coeur`, `genance`, `toxique`, `exces`, avec une valeur de -2 à 3 (ex. `` `exces:3 genance:1` ``). Sans stats, la question compte quand même pour les victoires mais pas pour le radar.
- Version anglaise (optionnelle) : `<!-- en: Name -->` sous la ligne id pour le nom du set, `> en: ...` pour la description, et une ligne `  en: Who would...?` juste sous chaque question. Sans traduction, la question s'affiche en français pour tout le monde.
- Version espagnole (optionnelle), pareil : `<!-- es: Nombre -->`, `> es: ...`, et `  es: ¿Quién...?` sous la ligne `en:` de chaque question. Sans traduction espagnole, l'anglais est utilisé.
- Étiquettes (optionnelles) après les stats, pour le questionnaire de profil : `#alcool #soiree #couple #celib #etudes #travail #gaming #sport #voiture #coloc #parents #enfants #homme #femme #jeune #adulte #mixte`. Une question étiquetée tombe moins souvent si peu de gens du groupe sont concernés (ex. `#couple` dans un groupe de célibataires), jamais à zéro.
- Supprimer une ligne retire la question (si elle a déjà été jouée, elle reste dans l'historique).
- Modifier le texte d'une question = la remplacer par une nouvelle.
- Redémarre le serveur pour appliquer les changements.

## 🎉 Soirées & Excès
<!-- id: soirees -->
<!-- en: Parties & Excess -->
<!-- es: Fiestas y excesos -->
> Les soirées, l’alcool et les lendemains difficiles.
> en: Parties, booze and rough mornings after.
> es: Fiestas, alcohol y resacas chungas.

- Qui aurait le plus de chances de finir la soirée à dégueuler dans les chiottes ? `exces:3 genance:1` #alcool
  en: Who'd be most likely to end the night puking in the toilet?
  es: ¿Quién tendría más papeletas para acabar la noche potando en el váter?
- Qui disparaîtrait sans prévenir en plein milieu de la soirée ? `chaos:2 toxique:1` #soiree
  en: Who would vanish without a word right in the middle of the party?
  es: ¿Quién desaparecería sin avisar en plena fiesta?
- Qui sortirait les shots alors que personne n’en veut ? `exces:3 chaos:1` #alcool
  en: Who'd bust out the shots when nobody wants any?
  es: ¿Quién sacaría los chupitos cuando nadie quiere?
- Qui aurait la pire gueule de bois du groupe ? `exces:3` #alcool
  en: Who'd have the worst hangover in the group?
  es: ¿Quién tendría la peor resaca del grupo?
- Qui finirait la soirée en pleurant dans les toilettes ? `genance:2 exces:2`
  en: Who'd end the night crying in the bathroom?
  es: ¿Quién acabaría la noche llorando en el baño?
- Qui serait le premier à se faire virer d’une boîte ? `chaos:3 exces:1` #soiree
  en: Who'd be the first to get kicked out of a club?
  es: ¿A quién echarían el primero de una discoteca?
- Qui se souviendrait de rien le lendemain ? `exces:3 cerveau:-1` #alcool
  en: Who wouldn't remember a thing the next day?
  es: ¿Quién no se acordaría de nada al día siguiente?
- Qui pourrait rentrer à 10h du matin sans ses chaussures ? `chaos:2 exces:2` #soiree
  en: Who could roll home at 10am with no shoes on?
  es: ¿Quién podría volver a casa a las 10 de la mañana sin zapatos?
- Qui serait le premier à rentrer se coucher ? `exces:-2 chaos:-1`
  en: Who'd be the first to head home to bed?
  es: ¿Quién sería el primero en irse a dormir?
- Qui draguerait le videur pour pouvoir rentrer ? `hot:2 chaos:1` #soiree
  en: Who'd flirt with the bouncer to get in?
  es: ¿Quién ligaría con el portero para poder entrar?
- Qui finirait toutes ses soirées au kebab à 4h du mat ? `exces:2` #soiree
  en: Who'd end every night out at the kebab place at 4am?
  es: ¿Quién acabaría siempre la noche en el kebab a las 4 de la mañana?
- Qui enverrait des vocaux incompréhensibles après trois verres ? `genance:2 exces:2` #alcool
  en: Who'd send voice notes nobody can understand after three drinks?
  es: ¿Quién mandaría audios que no hay quien entienda después de tres copas?
- Qui pourrait finir la soirée au commissariat ? `chaos:3 exces:1`
  en: Who could end the night at the police station?
  es: ¿Quién podría acabar la noche en comisaría?
- Qui ramènerait la bouteille la moins chère pour boire celle des autres ? `toxique:2 exces:1` #alcool
  en: Who'd bring the cheapest bottle so they can drink everyone else's?
  es: ¿Quién traería la botella más barata para beberse la de los demás?
- Qui deviendrait le plus insupportable après trois verres ? `toxique:2 exces:2` #alcool
  en: Who'd get the most unbearable after three drinks?
  es: ¿Quién se pondría más insoportable después de tres copas?
- Qui monopoliserait l’enceinte toute la soirée ? `toxique:1 chaos:2` #soiree
  en: Who'd hog the speaker all night?
  es: ¿Quién acapararía el altavoz toda la noche?
- Qui pourrait finir la nuit à dormir dans une baignoire ? `exces:2 chaos:2` #alcool
  en: Who could end up sleeping in a bathtub?
  es: ¿Quién podría acabar la noche durmiendo en una bañera?
- Qui serait le pire pour faire semblant d’être sobre ? `genance:2 exces:2` #alcool
  en: Who'd be the worst at pretending to be sober?
  es: ¿Quién sería el peor disimulando que va sobrio?
- Qui lancerait un after chez quelqu’un d’autre sans demander ? `chaos:2 toxique:1 exces:1` #soiree
  en: Who'd start an afterparty at someone else's place without asking?
  es: ¿Quién montaría un after en casa de otro sin preguntar?
- Qui aurait le plus de photos compromettantes des autres dans son téléphone ? `toxique:2` #soiree
  en: Who'd have the most compromising pics of everyone else on their phone?
  es: ¿Quién tendría más fotos comprometedoras de los demás en el móvil?
- Qui serait le premier à danser sur une table ? `chaos:2 hot:1 exces:1` #soiree
  en: Who'd be the first to dance on a table?
  es: ¿Quién sería el primero en bailar encima de una mesa?
- Qui arriverait à pécho à chaque soirée sans que personne comprenne comment ? `hot:3` #soiree
  en: Who'd manage to hook up at every party and nobody gets how?
  es: ¿Quién pillaría cacho en cada fiesta sin que nadie sepa cómo?
- Qui serait pompette après une seule bière ? `genance:2 exces:1` #alcool
  en: Who'd be tipsy after just one beer?
  es: ¿Quién se pondría piripi con una sola cerveza?
- Qui mélangerait tous les alcools « pour voir » ? `exces:3 cerveau:-2` #alcool
  en: Who'd mix every kind of booze "just to see"?
  es: ¿Quién mezclaría todo tipo de alcohol «a ver qué pasa»?
- Qui tiendrait les cheveux des autres quand ils vomissent ? `coeur:3 exces:-1` #alcool
  en: Who'd hold everyone's hair back when they puke?
  es: ¿Quién les sujetaría el pelo a los demás cuando vomitan?
- Qui organiserait les meilleures soirées ? `exces:2 chaos:1 coeur:1` #soiree
  en: Who'd throw the best parties?
  es: ¿Quién organizaría las mejores fiestas?
- Qui casserait un verre (ou trois) à chaque soirée ? `genance:2 chaos:1` #soiree
  en: Who'd break a glass (or three) at every party?
  es: ¿Quién rompería un vaso (o tres) en cada fiesta?
- Qui dirait « ce soir je bois pas » et finirait le plus déchiré de tous ? `exces:3 cerveau:-1` #alcool
  en: Who'd say "I'm not drinking tonight" and end up the most wasted of all?
  es: ¿Quién diría «hoy no bebo» y acabaría el más pedo de todos?
- Qui pourrait se réveiller dans une autre ville sans savoir comment ? `chaos:3 exces:1` #alcool
  en: Who could wake up in another city with no clue how they got there?
  es: ¿Quién podría despertarse en otra ciudad sin saber cómo ha llegado?
- Qui deviendrait meilleur pote avec des inconnus aux toilettes de la boîte ? `exces:2 chaos:1` #soiree
  en: Who'd become best friends with total strangers in the club bathroom?
  es: ¿Quién se haría mejor amigo de unos desconocidos en el baño de la disco?
- Qui tu choisirais pour te ramener chez toi après une soirée trop arrosée ? `coeur:3 exces:-2` #alcool
  en: Who would you pick to get you home after a way too boozy night?
  es: ¿A quién elegirías para que te lleve a casa después de pasarte bebiendo?
- À qui tu confierais ta CB pour toute une soirée ? `coeur:2 exces:-2 cerveau:1`
  en: Who would you trust with your card for a whole night out?
  es: ¿A quién le dejarías tu tarjeta para toda una noche de fiesta?
- Avec qui tu partirais en after jusqu’à midi ? `exces:3 chaos:2` #soiree
  en: Who would you hit an afterparty with till noon?
  es: ¿Con quién te irías de after hasta mediodía?
- Qui tu appellerais pour sauver une soirée qui meurt ? `chaos:2 exces:2` #soiree
  en: Who would you call to save a dying party?
  es: ¿A quién llamarías para salvar una fiesta que se está muriendo?
- Qui ferait un PowerPoint en soirée pour défendre une théorie absurde ? `cerveau:1 genance:2 chaos:1` #soiree
  en: Who’d make a PowerPoint at a party to defend an absurd theory?
  es: ¿Quién haría un PowerPoint en una fiesta para defender una teoría absurda?
- Qui lancerait un débat philo à 4h du matin ? `cerveau:2 exces:1` #soiree
  en: Who’d start a philosophy debate at 4am?
  es: ¿Quién montaría un debate filosófico a las 4 de la mañana?

## 💀 Sans filtre
<!-- id: sans-filtre -->
<!-- en: No Filter -->
<!-- es: Sin filtro -->
> Les vérités qui piquent.
> en: The truths that sting.
> es: Las verdades que escuecen.

- Qui finirait seul avec 12 chats ? `genance:2 hot:-2`
  en: Who'd end up alone with 12 cats?
  es: ¿Quién acabaría solo con 12 gatos?
- Qui serait le plus hypocrite du groupe ? `toxique:3`
  en: Who'd be the biggest hypocrite in the group?
  es: ¿Quién sería el más hipócrita del grupo?
- Qui serait le plus radin au moment de partager l’addition ? `toxique:2`
  en: Who'd be the cheapest when it's time to split the bill?
  es: ¿Quién sería el más rata a la hora de pagar la cuenta?
- Qui serait le plus fake sur les réseaux ? `toxique:3`
  en: Who'd be the fakest on social media?
  es: ¿Quién sería el más falso en redes?
- Qui serait le pire ami du groupe ? `toxique:2 coeur:-2`
  en: Who'd be the worst friend in the group?
  es: ¿Quién sería el peor amigo del grupo?
- Qui parlerait le plus dans le dos des autres ? `toxique:3`
  en: Who'd talk the most behind everyone's back?
  es: ¿Quién hablaría más a espaldas de los demás?
- Qui ne serait là que quand ça l’arrange ? `toxique:2 coeur:-2`
  en: Who'd only show up when it suits them?
  es: ¿Quién solo aparecería cuando le conviene?
- Qui oublierait ton anniversaire mais exigerait qu’on fête le sien ? `toxique:3`
  en: Who'd forget your birthday but demand we celebrate theirs?
  es: ¿Quién se olvidaría de tu cumple pero exigiría que celebremos el suyo?
- Qui serait le premier à balancer tout le groupe pour sauver sa peau ? `toxique:3 coeur:-2`
  en: Who'd be the first to rat out the whole group to save their own skin?
  es: ¿Quién sería el primero en chivarse de todo el grupo para salvar el pellejo?
- Qui ferait un bide total en stand-up ? `genance:2 cerveau:-1`
  en: Who'd totally bomb doing stand-up?
  es: ¿Quién la cagaría a lo grande haciendo un monólogo?
- Qui serait persuadé d’être plus canon qu’il ne l’est ? `genance:2 hot:-1 toxique:1`
  en: Who'd be convinced they're way hotter than they actually are?
  es: ¿Quién se creería mucho más guapo de lo que es?
- Qui aurait le pire goût en tout (fringues, musique, déco…) ? `genance:2 cerveau:-1`
  en: Who'd have the worst taste in everything (clothes, music, decor...)?
  es: ¿Quién tendría el peor gusto para todo (ropa, música, decoración…)?
- Qui serait le plus jaloux du succès des autres ? `toxique:3`
  en: Who'd be the most jealous of other people's success?
  es: ¿Quién tendría más envidia del éxito de los demás?
- Qui perdrait un débat contre un enfant de 8 ans ? `cerveau:-2 genance:1`
  en: Who'd lose a debate to an 8-year-old?
  es: ¿Quién perdería un debate contra un niño de 8 años?
- Qui se ferait virer du groupe en premier si on votait pour de vrai ? `toxique:2 genance:2`
  en: Who'd get kicked out of the group first if we voted for real?
  es: ¿A quién echaríamos primero del grupo si votáramos de verdad?
- Qui mentirait même pour des trucs complètement inutiles ? `toxique:2 chaos:1`
  en: Who'd lie even about totally pointless stuff?
  es: ¿Quién mentiría hasta por chorradas sin importancia?
- Qui ne rendrait jamais l’argent qu’on lui prête ? `toxique:2 chaos:1`
  en: Who'd never pay back money you lend them?
  es: ¿Quién no devolvería nunca el dinero que le prestas?
- Qui aurait le plus de chances de se faire ghoster par le groupe ? `genance:2 toxique:1`
  en: Who'd be most likely to get ghosted by the group?
  es: ¿Quién tendría más papeletas para que el grupo le hiciera ghosting?
- Qui serait pote avec des gens juste pour leur appart ou leur piscine ? `toxique:3 coeur:-1`
  en: Who'd be friends with people just for their place or their pool?
  es: ¿Quién se haría amigo de gente solo por su piso o su piscina?
- Qui raconterait les histoires les plus longues et les moins intéressantes ? `genance:2 cerveau:-1`
  en: Who'd tell the longest, most boring stories?
  es: ¿Quién contaría las historias más largas y menos interesantes?
- Qui pleurnicherait le plus pour un rien ? `genance:2 toxique:1`
  en: Who'd whine the most over nothing?
  es: ¿Quién lloriquearía más por cualquier tontería?
- Qui arriverait à nous manipuler sans qu’on s’en rende compte ? `toxique:3 cerveau:1`
  en: Who'd manage to manipulate us without us even noticing?
  es: ¿Quién conseguiría manipularnos sin que nos diéramos cuenta?
- Qui aurait le moins d’amis en dehors du groupe ? `genance:2 hot:-1`
  en: Who'd have the fewest friends outside the group?
  es: ¿Quién tendría menos amigos fuera del grupo?
- Qui pourrait vendre sa mère pour 1 000 balles ? `toxique:3 chaos:1`
  en: Who could sell their own mom for 1,000 bucks?
  es: ¿Quién sería capaz de vender a su madre por 1.000 pavos?
- Qui ferait semblant d’écouter quand on lui parle ? `toxique:2`
  en: Who'd pretend to listen when you're talking to them?
  es: ¿Quién haría como que te escucha cuando le hablas?
- Qui lécherait le plus les bottes de son boss ? `toxique:2` #travail
  en: Who'd suck up to their boss the most?
  es: ¿Quién le haría más la pelota a su jefe?
- Qui aurait la pire hygiène en coloc ? `genance:3 hot:-2` #coloc
  en: Who'd have the worst hygiene as a roommate?
  es: ¿Quién tendría la peor higiene compartiendo piso?
- Qui nous lâcherait dès sa première relation sérieuse ? `toxique:2 coeur:-2`
  en: Who'd ditch us as soon as they got into their first serious relationship?
  es: ¿Quién nos dejaría tirados en cuanto tuviera su primera relación seria?
- Qui squatterait chez les autres pour vider leur frigo ? `exces:2 toxique:2`
  en: Who'd crash at other people's places just to raid their fridge?
  es: ¿Quién se acoplaría en casa de los demás para vaciarles la nevera?
- Qui deviendrait insupportable dès qu’il a faim ? `toxique:2 chaos:1`
  en: Who'd get unbearable the second they're hungry?
  es: ¿Quién se pondría insoportable en cuanto tiene hambre?
- À qui tu ferais le moins confiance avec un secret ? `toxique:2 coeur:-2`
  en: Who would you trust the least with a secret?
  es: ¿En quién confiarías menos para guardar un secreto?
- Qui tu choisirais en dernier dans une équipe ? `genance:2 cerveau:-1`
  en: Who would you pick last for your team?
  es: ¿A quién elegirías el último para tu equipo?
- Qui tu bloquerais en premier si tu devais bloquer quelqu’un du groupe ? `toxique:2`
  en: Who would you block first if you had to block someone in the group?
  es: ¿A quién bloquearías primero si tuvieras que bloquear a alguien del grupo?
- Qui tu inviterais jamais à un repas de famille ? `genance:2 chaos:1`
  en: Who would you never invite to a family dinner?
  es: ¿A quién no invitarías nunca a una comida familiar?
- Qui quitterait le groupe WhatsApp sur un coup de tête ? `chaos:2 toxique:1`
  en: Who’d leave the group chat on a whim?
  es: ¿Quién se saldría del grupo de WhatsApp en un arrebato?

## 🔮 Futur & Destin
<!-- id: futur -->
<!-- en: Future & Fate -->
<!-- es: Futuro y destino -->
> Qui finira où dans 10 ans ?
> en: Who ends up where in 10 years?
> es: ¿Dónde estará cada uno dentro de 10 años?

- Qui sera le plus riche dans 10 ans ? `cerveau:2 hot:1`
  en: Who'll be the richest in 10 years?
  es: ¿Quién será el más rico dentro de 10 años?
- Qui divorcera en premier ? `chaos:2 toxique:1`
  en: Who'll get divorced first?
  es: ¿Quién se divorciará primero?
- Qui finira en prison ? `chaos:3 toxique:1`
  en: Who'll end up in prison?
  es: ¿Quién acabará en la cárcel?
- Qui aura un enfant en premier ? `hot:1 chaos:1`
  en: Who'll have a kid first?
  es: ¿Quién tendrá un hijo primero?
- Qui deviendra célèbre, mais pour de mauvaises raisons ? `chaos:2 genance:2`
  en: Who'll get famous, but for all the wrong reasons?
  es: ¿Quién se hará famoso, pero por lo que no debe?
- Qui fera la pire crise de la quarantaine ? `genance:2 chaos:2`
  en: Who'll have the worst midlife crisis?
  es: ¿Quién tendrá la peor crisis de los cuarenta?
- Qui finira dans une secte ? `cerveau:-2 chaos:1`
  en: Who'll end up in a cult?
  es: ¿Quién acabará en una secta?
- Qui vivra encore chez ses parents à 35 ans ? `genance:2 cerveau:-1`
  en: Who'll still be living with their parents at 35?
  es: ¿Quién seguirá viviendo con sus padres a los 35?
- Qui aura le plus d’enfants ? `hot:2 chaos:1`
  en: Who'll have the most kids?
  es: ¿Quién tendrá más hijos?
- Qui sera le dernier à se caser ? `chaos:2 toxique:1`
  en: Who'll be the last to settle down?
  es: ¿Quién será el último en sentar la cabeza?
- Qui finira en cure de désintox ? `exces:3 chaos:1`
  en: Who'll end up in rehab?
  es: ¿Quién acabará en desintoxicación?
- Qui deviendra influenceur et vendra des formations bidon ? `toxique:2 genance:2`
  en: Who'll become an influencer selling scammy online courses?
  es: ¿Quién se hará influencer y venderá cursos que son puro humo?
- Qui sera le premier à faire faillite ? `chaos:2 cerveau:-2`
  en: Who'll be the first to go bankrupt?
  es: ¿Quién será el primero en arruinarse?
- Qui pourrait devenir maire ou député ? `cerveau:2 toxique:2`
  en: Who could become a mayor or a politician?
  es: ¿Quién podría acabar de alcalde o diputado?
- Qui aura la vie la plus chiante, avec pavillon et labrador ? `chaos:-2 exces:-1`
  en: Who'll have the most boring life, with a house in the suburbs and a labrador?
  es: ¿Quién tendrá la vida más aburrida, con su adosado y su labrador?
- Qui plaquera tout pour élever des chèvres dans le Larzac ? `chaos:2 exces:-1`
  en: Who'll drop everything to go raise goats in the middle of nowhere?
  es: ¿Quién lo dejará todo para irse a criar cabras a un pueblo perdido?
- Qui se mariera à Las Vegas sur un coup de tête ? `chaos:3 exces:2`
  en: Who'll get married in Vegas on a whim?
  es: ¿Quién se casará en Las Vegas sin pensárselo?
- Qui épousera quelqu’un de 30 ans de plus pour l’héritage ? `toxique:3 hot:2`
  en: Who'll marry someone 30 years older for the inheritance?
  es: ¿Quién se casará con alguien 30 años mayor por la herencia?
- Qui vieillira le plus mal ? `hot:-2 exces:1`
  en: Who'll age the worst?
  es: ¿Quién envejecerá peor?
- Qui sera le parent le plus relou à la sortie de l’école ? `genance:2 toxique:1`
  en: Who'll be the most annoying parent at school pickup?
  es: ¿Quién será el más pesado de los padres a la salida del cole?
- Qui finira candidat de télé-réalité ? `hot:2 genance:2 cerveau:-1`
  en: Who'll end up on a reality TV show?
  es: ¿Quién acabará en un reality?
- Qui sera le patron que tout le monde déteste ? `toxique:3 cerveau:1`
  en: Who'll be the boss everyone hates?
  es: ¿Quién será el jefe al que todo el mundo odia?
- Qui gagnera au Loto et perdra tout en un an ? `exces:2 chaos:2 cerveau:-1`
  en: Who'll win the lottery and blow it all in a year?
  es: ¿Quién ganará la lotería y se lo fundirá todo en un año?
- Qui sera encore en soirée à 50 ans comme si de rien n’était ? `exces:3 chaos:1` #soiree
  en: Who'll still be partying at 50 like nothing's changed?
  es: ¿Quién seguirá saliendo de fiesta a los 50 como si nada?
- Qui aura un prix Nobel ? `cerveau:3 exces:-1`
  en: Who'll win a Nobel Prize?
  es: ¿Quién ganará un premio Nobel?
- Qui finira par ne plus parler à personne du groupe ? `toxique:1 coeur:-2`
  en: Who'll end up not talking to anyone in the group anymore?
  es: ¿Quién acabará sin hablarse con nadie del grupo?
- Qui se fera refaire le nez en premier ? `hot:1 toxique:1`
  en: Who'll be the first to get a nose job?
  es: ¿Quién se operará la nariz primero?
- Qui se fera tromper en premier ? `genance:2 hot:-1`
  en: Who'll be the first to get cheated on?
  es: ¿A quién le pondrán los cuernos primero?
- Qui vivra jusqu’à 100 ans ? `exces:-2 chaos:-1`
  en: Who'll live to 100?
  es: ¿Quién llegará a los 100 años?
- Qui deviendra le vieux aigri du quartier ? `toxique:2 coeur:-1`
  en: Who'll turn into the bitter old grump of the neighborhood?
  es: ¿Quién se convertirá en el viejo cascarrabias del barrio?
- Qui tu choisirais comme parrain ou marraine de ton enfant ? `coeur:3 cerveau:1`
  en: Who would you pick as your kid's godparent?
  es: ¿A quién elegirías como padrino o madrina de tu hijo?
- Sur qui tu parierais pour devenir millionnaire ? `cerveau:2`
  en: Who would you bet on to become a millionaire?
  es: ¿Por quién apostarías para hacerse millonario?
- Qui tu choisirais comme témoin de mariage ? `coeur:3`
  en: Who would you pick as your best man or maid of honor?
  es: ¿A quién elegirías como testigo de tu boda?
- À qui tu confierais tes économies pour les investir ? `cerveau:3 coeur:1`
  en: Who would you trust to invest your savings?
  es: ¿A quién le confiarías tus ahorros para invertirlos?
- Qui organisera les retrouvailles du groupe dans 20 ans ? `coeur:2`
  en: Who’ll organise the group reunion in 20 years?
  es: ¿Quién organizará el reencuentro del grupo dentro de 20 años?

## 🤡 Gênance & Boulets
<!-- id: genance -->
<!-- en: Cringe & Klutzes -->
<!-- es: Vergüenza ajena y patosos -->
> Les bourdes et les moments gênants.
> en: The screwups and the cringe moments.
> es: Las meteduras de pata y los momentos de vergüenza ajena.

- Qui serait le premier à envoyer un message au mauvais destinataire ? `genance:3`
  en: Who'd be the first to text the wrong person?
  es: ¿Quién sería el primero en mandarle un mensaje a quien no era?
- Qui tomberait le plus souvent, même sans avoir bu ? `genance:3 exces:-1`
  en: Who'd fall over the most, even sober?
  es: ¿Quién se caería más veces, hasta sin haber bebido?
- Qui ferait les blagues les plus gênantes en public ? `genance:3`
  en: Who'd make the most cringe jokes in public?
  es: ¿Quién contaría los chistes que dan más vergüenza ajena en público?
- Qui répondrait « toi aussi » au serveur qui dit « bon appétit » ? `genance:2`
  en: Who'd say "you too" when the waiter says "enjoy your meal"?
  es: ¿Quién le diría «tú también» al camarero cuando dice «que aproveche»?
- Qui écrirait les pires textos (fautes, émojis, pavés) ? `genance:2 cerveau:-1`
  en: Who'd write the worst texts (typos, emojis, walls of text)?
  es: ¿Quién escribiría los peores mensajes (faltas, emojis, tochos)?
- Qui serait capable d’appeler sa prof « maman » ? `genance:3` #etudes
  en: Who'd be capable of calling their teacher "mom"?
  es: ¿Quién sería capaz de llamar «mamá» a su profe?
- Qui se retrouverait coincé quelque part (porte, ascenseur, pull) ? `genance:3 chaos:1`
  en: Who'd get stuck somewhere (door, elevator, sweater)?
  es: ¿Quién se quedaría atascado en algún sitio (puerta, ascensor, jersey)?
- Qui arriverait à se perdre même avec un GPS ? `cerveau:-2 genance:1`
  en: Who'd manage to get lost even with GPS?
  es: ¿Quién conseguiría perderse hasta con GPS?
- Qui rirait de ses propres blagues avant même de les finir ? `genance:2`
  en: Who'd laugh at their own jokes before even finishing them?
  es: ¿Quién se reiría de sus propios chistes antes de terminarlos?
- Qui saurait jamais quoi faire de ses mains sur les photos ? `genance:2 hot:-1`
  en: Who'd never know what to do with their hands in photos?
  es: ¿Quién nunca sabría qué hacer con las manos en las fotos?
- Qui ferait le discours le plus gênant à un mariage ? `genance:3 exces:1`
  en: Who'd give the most cringe speech at a wedding?
  es: ¿Quién daría el discurso más bochornoso en una boda?
- Qui chanterait le plus faux mais le plus fort au karaoké ? `genance:2 chaos:1`
  en: Who'd sing the most off-key but the loudest at karaoke?
  es: ¿Quién cantaría más desafinado pero más fuerte en el karaoke?
- Qui aurait le rire le plus gênant ? `genance:2`
  en: Who'd have the most cringe laugh?
  es: ¿Quién tendría la risa que da más vergüenza ajena?
- Qui raconterait des anecdotes que personne n’a demandées ? `genance:2`
  en: Who'd tell stories nobody asked for?
  es: ¿Quién contaría anécdotas que nadie ha pedido?
- Qui perdrait ses clés, son téléphone ou sa CB au moins une fois par mois ? `chaos:2 cerveau:-2`
  en: Who'd lose their keys, phone or card at least once a month?
  es: ¿Quién perdería las llaves, el móvil o la tarjeta al menos una vez al mes?
- Qui ferait coucou à quelqu’un qui saluait en fait la personne derrière ? `genance:3`
  en: Who'd wave back at someone who was actually waving at the person behind them?
  es: ¿Quién saludaría a alguien que en realidad estaba saludando a la persona de detrás?
- Qui aurait les pires photos de profil ? `genance:2 hot:-1`
  en: Who'd have the worst profile pics?
  es: ¿Quién tendría las peores fotos de perfil?
- Qui laisserait en vu trois jours pour répondre « mdr » ? `toxique:2 genance:1`
  en: Who'd leave you on read for three days just to reply "lol"?
  es: ¿Quién te dejaría en visto tres días para luego contestar «jajaja»?
- Qui aurait un fou rire à un enterrement ? `genance:2 chaos:2`
  en: Who'd get the giggles at a funeral?
  es: ¿A quién le daría un ataque de risa en un entierro?
- Qui danserait le plus mal ? `genance:2 hot:-1`
  en: Who'd be the worst dancer?
  es: ¿Quién bailaría peor?
- Qui aurait les vieux posts Facebook les plus cringe ? `genance:3`
  en: Who'd have the most cringe old Facebook posts?
  es: ¿Quién tendría los posts antiguos de Facebook más cringe?
- Qui confondrait tout le temps les prénoms des gens ? `genance:2 cerveau:-1`
  en: Who'd mix up people's names all the time?
  es: ¿Quién confundiría todo el rato los nombres de la gente?
- Qui tiendrait la porte trop tôt et obligerait les gens à courir ? `genance:2 coeur:1`
  en: Who'd hold the door way too early and make people run for it?
  es: ¿Quién sujetaría la puerta demasiado pronto y obligaría a la gente a correr?
- Qui raterait une marche devant son crush ? `genance:3 hot:-1`
  en: Who'd trip on a step in front of their crush?
  es: ¿Quién se comería un escalón delante de su crush?
- Qui sortirait des références que personne ne comprend ? `genance:1 cerveau:2`
  en: Who'd drop references nobody gets?
  es: ¿Quién soltaría referencias que nadie pilla?
- Qui dirait « je t’aime » par réflexe en raccrochant avec son boss ? `genance:3` #travail
  en: Who'd say "love you" out of habit when hanging up with their boss?
  es: ¿Quién diría «te quiero» por costumbre al colgarle a su jefe?
- Qui se ridiculiserait le plus en essayant d’avoir l’air cool ? `genance:3 hot:-1`
  en: Who'd embarrass themselves the most trying to look cool?
  es: ¿Quién haría más el ridículo intentando parecer guay?
- Qui finirait dernier à n’importe quel sport ? `genance:2 hot:-1`
  en: Who'd come in last at any sport?
  es: ¿Quién quedaría el último en cualquier deporte?
- Qui mettrait le plus de temps à comprendre une blague ? `cerveau:-2 genance:1`
  en: Who'd take the longest to get a joke?
  es: ¿Quién tardaría más en pillar un chiste?
- Qui serait incapable de raccrocher au téléphone ? `genance:2 coeur:1`
  en: Who'd never be able to hang up the phone?
  es: ¿Quién sería incapaz de colgar el teléfono?
- Qui tu emmènerais jamais à un entretien d’embauche ? `genance:3`
  en: Who would you never bring to a job interview?
  es: ¿A quién no llevarías nunca a una entrevista de trabajo?
- Qui tu cacherais le plus devant tes parents ? `genance:2 chaos:1`
  en: Who would you hide the most from your parents?
  es: ¿A quién esconderías más de tus padres?
- Qui tu éviterais de présenter à ton boss ? `genance:2 chaos:1` #travail
  en: Who would you avoid introducing to your boss?
  es: ¿A quién evitarías presentarle a tu jefe?
- Qui tu laisserais jamais parler à ton crush ? `genance:2 toxique:1`
  en: Who would you never let talk to your crush?
  es: ¿A quién no dejarías nunca hablar con tu crush?

## 💔 Love & Ex
<!-- id: love -->
<!-- en: Love & Exes -->
<!-- es: Amor y ex -->
> Crushs, ex et ruptures.
> en: Crushes, exes and breakups.
> es: Crushes, ex y rupturas.

- Qui aurait le plus de red flags ? `toxique:3 hot:1`
  en: Who'd have the most red flags?
  es: ¿Quién tendría más red flags?
- Qui retournerait toujours avec son ex ? `genance:2 chaos:1`
  en: Who'd always end up going back to their ex?
  es: ¿Quién acabaría volviendo siempre con su ex?
- Qui stalkerait encore son ex sur Insta ? `genance:2 toxique:1`
  en: Who'd still be stalking their ex on Insta?
  es: ¿Quién seguiría stalkeando a su ex en Insta?
- Qui tomberait amoureux en deux jours ? `chaos:2 coeur:1`
  en: Who'd fall in love in like two days?
  es: ¿Quién se enamoraría en dos días?
- Qui ghosterait le plus ? `toxique:3 hot:1`
  en: Who'd ghost people the most?
  es: ¿Quién haría más ghosting?
- Qui se ferait larguer de la manière la plus humiliante ? `genance:3`
  en: Who'd get dumped in the most humiliating way?
  es: ¿A quién dejarían de la forma más humillante?
- Qui aurait le pire goût en mecs ou en meufs ? `cerveau:-2`
  en: Who'd have the worst taste in guys or girls?
  es: ¿Quién tendría el peor gusto para los tíos o las tías?
- Qui enverrait « tu dors ? » à son ex à 3h du mat ? `exces:2 genance:2`
  en: Who'd text their ex "u up?" at 3am?
  es: ¿Quién le mandaría «¿duermes?» a su ex a las 3 de la mañana?
- Qui se ferait toujours friendzoner ? `genance:2 hot:-2`
  en: Who'd always get friendzoned?
  es: ¿A quién mandarían siempre a la friendzone?
- Qui collectionnerait les ex toxiques ? `cerveau:-1 chaos:2`
  en: Who'd collect toxic exes?
  es: ¿Quién coleccionaría ex tóxicos?
- Qui serait l’ex dont tout le monde parle en thérapie ? `toxique:3 hot:1`
  en: Who'd be the ex everyone talks about in therapy?
  es: ¿Quién sería el ex del que todo el mundo habla en terapia?
- Qui pourrait matcher avec quelqu’un de la famille d’un pote ? `chaos:2 genance:2`
  en: Who could match with someone from a friend's family?
  es: ¿Quién podría hacer match con alguien de la familia de un colega?
- Qui romprait avec un pavé de dix paragraphes sur WhatsApp ? `genance:2 chaos:1`
  en: Who'd break up with a ten paragraph essay on WhatsApp?
  es: ¿Quién cortaría con un tocho de diez párrafos por WhatsApp?
- Qui serait le plus jaloux en couple ? `toxique:3`
  en: Who'd be the most jealous in a relationship?
  es: ¿Quién sería el más celoso en pareja?
- Qui aurait un nouveau crush chaque semaine ? `hot:2 chaos:2`
  en: Who'd have a new crush every week?
  es: ¿Quién tendría un crush nuevo cada semana?
- Qui se remettrait en couple une semaine après une rupture ? `chaos:2 hot:1`
  en: Who'd be back in a relationship a week after a breakup?
  es: ¿Quién tendría pareja nueva una semana después de cortar?
- Qui posterait 40 stories avec sa moitié dès la première semaine ? `genance:3`
  en: Who'd post 40 stories with their other half in the very first week?
  es: ¿Quién subiría 40 stories con su pareja ya en la primera semana?
- Qui serait le meilleur pour consoler après une rupture ? `coeur:3 cerveau:1`
  en: Who'd be the best at cheering you up after a breakup?
  es: ¿Quién sería el mejor para consolarte después de una ruptura?
- Qui aurait le plus de matchs sur les applis ? `hot:3` #celib
  en: Who'd get the most matches on the apps?
  es: ¿Quién tendría más matches en las apps?
- Qui vivrait le pire premier date du groupe ? `genance:3`
  en: Who'd have the worst first date in the group?
  es: ¿Quién tendría la peor primera cita del grupo?
- Qui serait en couple mais draguerait quand même ? `toxique:3 hot:2`
  en: Who'd be in a relationship but still hit on people?
  es: ¿Quién tendría pareja y aun así seguiría ligando?
- Qui aurait les critères les plus irréalistes ? `toxique:2 cerveau:-1`
  en: Who'd have the most unrealistic standards?
  es: ¿Quién tendría las expectativas más irreales?
- Qui pleurerait le plus longtemps après une rupture ? `genance:1 coeur:1`
  en: Who'd cry the longest after a breakup?
  es: ¿Quién se pasaría más tiempo llorando después de una ruptura?
- Qui capterait jamais quand quelqu’un le drague ? `cerveau:-2`
  en: Who'd never get it when someone's hitting on them?
  es: ¿Quién no se enteraría nunca de que alguien le está tirando la caña?
- Qui bloquerait puis débloquerait son ex au moins cinq fois ? `chaos:2 genance:2`
  en: Who'd block and unblock their ex at least five times?
  es: ¿Quién bloquearía y desbloquearía a su ex al menos cinco veces?
- Qui se ferait tout un film à partir d’un simple like ? `genance:2 cerveau:-1`
  en: Who'd make up a whole movie in their head over one like?
  es: ¿Quién se montaría una película entera por un simple like?
- Qui mentirait le plus sur son profil Tinder ? `toxique:2 hot:-1` #celib
  en: Who'd lie the most on their Tinder profile?
  es: ¿Quién mentiría más en su perfil de Tinder?
- Qui pourrait se faire larguer par SMS le jour de son anniversaire ? `genance:2`
  en: Who could get dumped over text on their birthday?
  es: ¿A quién podrían dejar por mensaje el día de su cumple?
- Avec qui ce serait le plus simple d’être en couple ? `hot:2 coeur:2 cerveau:1`
  en: Who would be the easiest to date?
  es: ¿Con quién sería más fácil salir?
- Qui draguerait le plus mal ? `genance:3 hot:-2`
  en: Who'd be the worst at flirting?
  es: ¿Quién ligaría peor?
- À qui tu demanderais conseil pour ta vie amoureuse ? `cerveau:2 coeur:1`
  en: Who would you ask for advice about your love life?
  es: ¿A quién le pedirías consejo sobre tu vida amorosa?
- Qui tu choisirais pour t’organiser un date surprise ? `coeur:2 hot:1 cerveau:1`
  en: Who would you pick to plan you a surprise date?
  es: ¿A quién elegirías para que te organice una cita sorpresa?
- Qui tu présenterais à ton frère ou ta sœur ? `coeur:2 hot:1`
  en: Who would you introduce to your brother or sister?
  es: ¿A quién le presentarías a tu hermano o hermana?
- Qui tu emmènerais à un mariage comme faux date ? `hot:2 chaos:1`
  en: Who would you bring to a wedding as your fake date?
  es: ¿A quién llevarías a una boda como cita falsa?

## 🧟 Scénarios absurdes
<!-- id: absurde -->
<!-- en: Absurd Scenarios -->
<!-- es: Escenarios absurdos -->
> Zombies, île déserte, aliens et compagnie.
> en: Zombies, desert islands, aliens and all that.
> es: Zombis, islas desiertas, aliens y demás.

- Qui mourrait en premier dans une apocalypse zombie ? `cerveau:-2`
  en: Who'd die first in a zombie apocalypse?
  es: ¿Quién moriría primero en un apocalipsis zombi?
- Qui deviendrait gourou d’une secte en moins d’un mois ? `toxique:2 cerveau:1 chaos:1`
  en: Who'd become a cult leader in less than a month?
  es: ¿Quién se convertiría en gurú de una secta en menos de un mes?
- Qui se ferait mordre par un zombie et le cacherait au groupe ? `toxique:3 chaos:1`
  en: Who'd get bitten by a zombie and hide it from the group?
  es: ¿Quién acabaría mordido por un zombi y se lo escondería al grupo?
- Qui serait le premier à manger quelqu’un sur une île déserte ? `toxique:2 exces:2 chaos:1`
  en: Who'd be the first to eat someone on a desert island?
  es: ¿Quién sería el primero en comerse a alguien en una isla desierta?
- Qui finirait par parler à un ballon de volley sur une île déserte ? `genance:2 chaos:1`
  en: Who'd end up talking to a volleyball on a desert island?
  es: ¿Quién acabaría hablando con un balón de voleibol en una isla desierta?
- Qui ouvrirait la porte au tueur dans un film d’horreur ? `cerveau:-2 genance:2`
  en: Who'd open the door for the killer in a horror movie?
  es: ¿Quién le abriría la puerta al asesino en una peli de terror?
- Qui descendrait seul à la cave en criant « y’a quelqu’un ? » ? `cerveau:-2 genance:1`
  en: Who'd go down to the basement alone yelling "is anyone there"?
  es: ¿Quién bajaría solo al sótano gritando «¿hay alguien?»?
- Qui serait le cerveau d’un braquage de banque ? `cerveau:3 toxique:1`
  en: Who'd be the mastermind of a bank heist?
  es: ¿Quién sería el cerebro de un atraco a un banco?
- Qui ferait foirer un braquage en postant une story pendant le casse ? `genance:3 cerveau:-2`
  en: Who'd screw up a heist by posting a story in the middle of the robbery?
  es: ¿Quién la cagaría en un atraco por subir una story en pleno robo?
- Qui finirait en prison à Fort Boyard ? `cerveau:-2 genance:1`
  en: Who'd end up locked in the cell on Fort Boyard?
  es: ¿Quién acabaría encerrado en la celda de Fort Boyard?
- Qui gagnerait Koh-Lanta en manipulant tout le monde ? `toxique:2 cerveau:2`
  en: Who'd win Survivor by manipulating everyone?
  es: ¿Quién ganaría Supervivientes manipulando a todo el mundo?
- Qui se ferait éliminer de Koh-Lanta pour avoir volé du riz ? `toxique:1 exces:2`
  en: Who'd get voted off Survivor for stealing rice?
  es: ¿A quién expulsarían de Supervivientes por robar arroz?
- Qui se ferait virer d’une télé-réalité pour une bagarre en piscine ? `chaos:3 exces:1`
  en: Who'd get kicked off a reality show for a fight in the pool?
  es: ¿A quién echarían de un reality por montar una pelea en la piscina?
- Qui serait le candidat le plus détesté d’une télé-réalité ? `toxique:3`
  en: Who'd be the most hated contestant on a reality show?
  es: ¿Quién sería el concursante más odiado de un reality?
- Qui se ferait brûler pour sorcellerie au Moyen Âge ? `chaos:2`
  en: Who'd get burned as a witch in the Middle Ages?
  es: ¿A quién quemarían por brujería en la Edad Media?
- Qui serait le premier à mourir dans Squid Game ? `cerveau:-2 genance:2`
  en: Who'd be the first to die in Squid Game?
  es: ¿Quién sería el primero en morir en El juego del calamar?
- Qui se ferait renvoyer sur Terre par les aliens parce qu’il est trop chiant ? `toxique:2 genance:2`
  en: Who'd get sent back to Earth by aliens for being too damn annoying?
  es: ¿A quién devolverían los aliens a la Tierra por dar demasiado el coñazo?
- Qui serait le pire représentant de l’humanité face aux aliens ? `genance:3 cerveau:-1`
  en: Who'd be the worst person to represent humanity to the aliens?
  es: ¿Quién sería el peor representante de la humanidad ante los aliens?
- Qui vendrait la Terre aux aliens contre un vaisseau perso ? `toxique:3 coeur:-2`
  en: Who'd sell Earth to the aliens for their own spaceship?
  es: ¿Quién vendería la Tierra a los aliens a cambio de una nave propia?
- Qui ferait une teuf dans le bunker pendant la fin du monde ? `exces:3 chaos:2`
  en: Who'd throw a party in the bunker during the end of the world?
  es: ¿Quién montaría una fiesta en el búnker en pleno fin del mundo?
- Qui planquerait l’alcool du bunker pour lui tout seul ? `exces:3 toxique:2` #alcool
  en: Who'd stash the bunker's booze to keep it all for themselves?
  es: ¿Quién escondería el alcohol del búnker para quedárselo todo?
- Qui survivrait le plus longtemps seul dans la forêt ? `cerveau:2 chaos:-1`
  en: Who'd survive the longest alone in the woods?
  es: ¿Quién sobreviviría más tiempo solo en el bosque?
- Qui serait le zombie le plus lent et le plus pathétique ? `genance:3 cerveau:-1`
  en: Who'd be the slowest, most pathetic zombie?
  es: ¿Quién sería el zombi más lento y más patético?
- Qui pourrait déclencher une guerre nucléaire en appuyant sur le mauvais bouton ? `chaos:3 cerveau:-2`
  en: Who could start a nuclear war by pressing the wrong button?
  es: ¿Quién podría empezar una guerra nuclear por darle al botón equivocado?
- Qui deviendrait un dictateur si on lui filait un pays ? `toxique:3 chaos:2`
  en: Who'd turn into a dictator if you gave them a country?
  es: ¿Quién se volvería un dictador si le dieran un país?
- Qui se ferait posséder par un démon et on verrait même pas la différence ? `toxique:2 chaos:2`
  en: Who'd get possessed by a demon and we wouldn't even notice the difference?
  es: ¿Quién acabaría poseído por un demonio y ni notaríamos la diferencia?
- Qui lirait le livre maudit à voix haute « juste pour voir » ? `chaos:2 cerveau:-2`
  en: Who'd read the cursed book out loud "just to see"?
  es: ¿Quién leería en voz alta el libro maldito «solo para ver qué pasa»?
- Qui deviendrait un mème en passant au JT ? `genance:3 chaos:1`
  en: Who'd turn into a meme after showing up on the news?
  es: ¿Quién se haría meme por salir en el telediario?
- Qui serait l’imposteur dans un vrai Among Us ? `toxique:2 cerveau:2`
  en: Who'd be the impostor in a real life Among Us?
  es: ¿Quién sería el impostor en un Among Us de verdad?
- Qui garderait la planche pour lui tout seul dans Titanic ? `toxique:2 coeur:-2`
  en: Who'd keep the door all to themselves in Titanic?
  es: ¿Quién se quedaría con toda la tabla en Titanic?
- Qui tu choisirais avec toi pour survivre à une apocalypse zombie ? `cerveau:2 coeur:1`
  en: Who would you pick to survive a zombie apocalypse with you?
  es: ¿A quién elegirías para sobrevivir contigo a un apocalipsis zombi?
- Qui tu emmènerais sur une île déserte ? `coeur:2 cerveau:1`
  en: Who would you take to a desert island?
  es: ¿A quién te llevarías a una isla desierta?
- Qui tu prendrais dans ton équipe pour un braquage ? `cerveau:2 toxique:1`
  en: Who would you want on your team for a heist?
  es: ¿A quién meterías en tu equipo para un atraco?
- Qui tu sacrifierais en premier pour échapper aux zombies ? `genance:2 cerveau:-1`
  en: Who would you sacrifice first to get away from the zombies?
  es: ¿A quién sacrificarías primero para escapar de los zombis?

## 🧠 Vie d’adulte
<!-- id: adulte -->
<!-- en: Adulting -->
<!-- es: Vida adulta -->
> Loyer, boulot, coloc : la vraie vie.
> en: Rent, work, roommates. Real life.
> es: Alquiler, curro, compis de piso: la vida real.

- Qui serait à découvert dès le 5 du mois ? `cerveau:-1 exces:2 chaos:1`
  en: Who'd be overdrawn by the 5th of the month?
  es: ¿Quién estaría en números rojos ya el día 5?
- Qui serait le coloc qui ne sort jamais les poubelles ? `toxique:2 chaos:1` #coloc
  en: Who'd be the roommate who never takes out the trash?
  es: ¿Quién sería el compi de piso que nunca saca la basura?
- Qui arriverait à tuer un cactus ? `genance:2 cerveau:-2`
  en: Who'd manage to kill a cactus?
  es: ¿Quién conseguiría matar un cactus?
- Qui oublierait de déclarer ses impôts ? `cerveau:-2 chaos:1`
  en: Who'd forget to do their taxes?
  es: ¿Quién se olvidaría de hacer la declaración de la renta?
- Qui mangerait encore des pâtes au ketchup à 30 ans ? `genance:2 cerveau:-1`
  en: Who'd still be eating pasta with ketchup at 30?
  es: ¿Quién seguiría comiendo pasta con kétchup a los 30?
- Qui serait le premier à se faire virer pour avoir mal parlé à son boss ? `chaos:3 toxique:1` #travail
  en: Who'd be the first to get fired for mouthing off to their boss?
  es: ¿Quién sería el primero en ir a la calle por contestarle mal a su jefe?
- Qui mentirait le plus sur son salaire ? `toxique:2`
  en: Who'd lie the most about their salary?
  es: ¿Quién mentiría más sobre su sueldo?
- Qui serait proprio avant 30 ans grâce à papa-maman ? `toxique:1 chaos:-1` #jeune
  en: Who'd own a place before 30 thanks to mommy and daddy?
  es: ¿Quién tendría piso propio antes de los 30 gracias a papá y mamá?
- Qui commanderait Uber Eats trois fois par semaine en disant qu’il fait des économies ? `exces:3 cerveau:-1`
  en: Who'd order Uber Eats three times a week while saying they're saving money?
  es: ¿Quién pediría Uber Eats tres veces por semana diciendo que está ahorrando?
- Qui serait le coloc qui pique la bouffe des autres dans le frigo ? `toxique:3 exces:1` #coloc
  en: Who'd be the roommate who steals everyone else's food from the fridge?
  es: ¿Quién sería el compi de piso que se come la comida de los demás?
- Qui aurait le frigo le plus triste du groupe ? `genance:2 exces:1`
  en: Who'd have the saddest fridge in the group?
  es: ¿Quién tendría la nevera más triste del grupo?
- Qui appellerait encore sa mère pour savoir comment cuire un œuf ? `cerveau:-2 genance:2`
  en: Who'd still call their mom to ask how to cook an egg?
  es: ¿Quién seguiría llamando a su madre para preguntar cómo se hace un huevo?
- Qui dépenserait toute sa prime en une soirée ? `exces:3 chaos:2`
  en: Who'd blow their whole bonus in one night?
  es: ¿Quién se fundiría el bonus entero en una sola noche?
- Qui se ferait arnaquer par une fausse crypto ? `cerveau:-2 chaos:1`
  en: Who'd get scammed by some fake crypto?
  es: ¿A quién estafarían con una cripto falsa?
- Qui ferait une sieste aux toilettes du boulot ? `exces:1 genance:2` #travail
  en: Who'd take a nap in the bathroom at work?
  es: ¿Quién se echaría una siesta en el baño del curro?
- Qui enverrait des mails pros remplis de fautes et d’émojis ? `genance:3 cerveau:-1` #travail
  en: Who'd send work emails full of typos and emojis?
  es: ¿Quién mandaría correos de trabajo llenos de faltas y emojis?
- Qui serait le collègue qui s’attribue le travail des autres ? `toxique:3` #travail
  en: Who'd be the coworker who takes credit for everyone else's work?
  es: ¿Quién sería el compañero de curro que se cuelga las medallas de los demás?
- Qui laisserait son linge propre sur une chaise pendant trois semaines ? `chaos:2`
  en: Who'd leave their clean laundry on a chair for three weeks?
  es: ¿Quién dejaría la ropa limpia en una silla durante tres semanas?
- Qui laisserait la vaisselle tremper pendant une semaine ? `toxique:2 chaos:1`
  en: Who'd leave the dishes soaking for a week?
  es: ¿Quién dejaría los platos en remojo una semana entera?
- Qui pourrait faire une crise d’angoisse devant un formulaire de la CAF ? `cerveau:-1 genance:2`
  en: Who could have a panic attack over a government benefits form?
  es: ¿Quién podría tener un ataque de ansiedad con un formulario de la Seguridad Social?
- Qui serait le coloc qui ramène quelqu’un de différent chaque semaine ? `chaos:2 hot:2 toxique:1` #coloc
  en: Who'd be the roommate who brings someone different home every week?
  es: ¿Quién sería el compi de piso que trae a alguien distinto cada semana?
- Qui accumulerait le plus d’amendes impayées ? `chaos:2 cerveau:-1`
  en: Who'd rack up the most unpaid tickets?
  es: ¿Quién acumularía más multas sin pagar?
- Qui ferait un tableau Excel pour partager l’addition au centime près ? `cerveau:2 chaos:-1`
  en: Who'd make an Excel sheet to split the bill down to the cent?
  es: ¿Quién haría un Excel para dividir la cuenta hasta el último céntimo?
- Qui laisserait son courrier s’empiler sans jamais l’ouvrir ? `cerveau:-1 chaos:1`
  en: Who'd let their mail pile up and never open it?
  es: ¿Quién dejaría que se le acumulasen las cartas sin abrir ni una?
- Qui ferait du télétravail depuis son lit toute la journée ? `exces:2` #travail
  en: Who'd work from home in bed all day?
  es: ¿Quién teletrabajaría desde la cama todo el día?
- Qui serait capable de démissionner par message vocal ? `chaos:3` #travail
  en: Who'd be capable of quitting by voice message?
  es: ¿Quién sería capaz de dejar el curro con un audio?
- Qui serait le premier à retourner vivre chez ses parents ? `genance:2 cerveau:-1`
  en: Who'd be the first to move back in with their parents?
  es: ¿Quién sería el primero en volver a vivir con sus padres?
- Qui ferait le riche sur Insta en étant à découvert ? `exces:2 toxique:1`
  en: Who'd flex like they're rich on Insta while their account's in the red?
  es: ¿Quién iría de rico en Insta estando en números rojos?
- Qui serait le plus adulte du groupe ? `cerveau:2 chaos:-2`
  en: Who'd be the most grown up in the group?
  es: ¿Quién sería el más adulto del grupo?
- Qui pourrait foutre le feu à sa cuisine en faisant des pâtes ? `chaos:2 cerveau:-2`
  en: Who could set their kitchen on fire making pasta?
  es: ¿Quién podría pegarle fuego a su cocina haciendo pasta?
- À qui tu confierais les clés de ton appart ? `coeur:3 cerveau:1`
  en: Who would you trust with your apartment keys?
  es: ¿A quién le dejarías las llaves de tu piso?
- Qui tu choisirais comme coloc ? `coeur:2`
  en: Who would you pick as a roommate?
  es: ¿A quién elegirías como compi de piso?
- Qui tu appellerais pour monter un meuble IKEA ? `cerveau:2`
  en: Who would you call to build your IKEA furniture?
  es: ¿A quién llamarías para montar un mueble de IKEA?
- À qui tu confierais ta plante pendant les vacances ? `cerveau:1 coeur:1`
  en: Who would you trust with your plant while you're on vacation?
  es: ¿A quién le dejarías tu planta en vacaciones?
- Qui rendrait son mémoire à 23h59 ? `chaos:2` #etudes
  en: Who’d hand in their dissertation at 11:59pm?
  es: ¿Quién entregaría el TFG a las 23:59?
- Qui ferait des nuits blanches avant chaque partiel ? `exces:1 chaos:1` #etudes
  en: Who’d pull an all-nighter before every exam?
  es: ¿Quién se pasaría la noche en vela antes de cada examen?
- Qui dormirait au premier rang de l’amphi ? `genance:2` #etudes
  en: Who’d fall asleep in the front row of a lecture?
  es: ¿Quién se dormiría en primera fila en clase?
- Qui changerait trois fois d’orientation ? `chaos:2` #etudes
  en: Who’d switch courses three times?
  es: ¿Quién se cambiaría de carrera tres veces?
- Qui ferait un stage où il ne fait que des cafés ? `genance:1 cerveau:-1` #etudes
  en: Who’d do an internship that’s just making coffee?
  es: ¿Quién haría unas prácticas en las que solo pone cafés?
- Qui quitterait un CDI pour « se lancer » ? `chaos:2` #travail
  en: Who’d quit a safe job to “go it alone”?
  es: ¿Quién dejaría un contrato indefinido para «emprender»?
- Qui négocierait le mieux son salaire ? `cerveau:2 toxique:1` #travail
  en: Who’d negotiate their salary best?
  es: ¿Quién negociaría mejor su sueldo?
- Qui organiserait des réunions qui auraient pu être un mail ? `genance:1 toxique:1` #travail
  en: Who’d hold meetings that could’ve been an email?
  es: ¿Quién convocaría reuniones que podrían haber sido un correo?
- Qui aurait un LinkedIn plus impressionnant que sa vraie vie ? `genance:1 toxique:1`
  en: Whose LinkedIn would be more impressive than their actual life?
  es: ¿Quién tendría un LinkedIn más impresionante que su vida real?
- Qui cartonnerait au premier entretien d’embauche ? `cerveau:2 hot:1`
  en: Who’d smash their first job interview?
  es: ¿Quién lo petaría en su primera entrevista de trabajo?

## 🤫 Secrets & Mensonges
<!-- id: secrets -->
<!-- en: Secrets & Lies -->
<!-- es: Secretos y mentiras -->
> Mythos, potins et cachotteries.
> en: Tall tales, gossip and sneaky stuff.
> es: Trolas, cotilleos y secretitos.

- Qui mentirait le mieux en nous regardant droit dans les yeux ? `toxique:3 cerveau:1`
  en: Who'd lie the best while looking us dead in the eye?
  es: ¿Quién mentiría mejor mirándonos a los ojos?
- Qui balancerait un secret du groupe pour se rendre intéressant ? `toxique:2 coeur:-2`
  en: Who'd spill a group secret just to look interesting?
  es: ¿Quién soltaría un secreto del grupo solo para llamar la atención?
- Qui pourrait avoir une double vie sans qu’on le sache ? `cerveau:2 chaos:1 toxique:1`
  en: Who could have a double life without us knowing?
  es: ¿Quién podría llevar una doble vida sin que lo supiéramos?
- Qui raconterait les potins des autres en disant « mais tu le dis à personne » ? `toxique:3`
  en: Who'd spread everyone's gossip going "but don't tell anyone"?
  es: ¿Quién contaría los cotilleos de los demás diciendo «pero no se lo digas a nadie»?
- Qui serait incapable de mentir ? `coeur:2`
  en: Who'd be totally incapable of lying?
  es: ¿Quién sería incapaz de mentir?
- Qui tricherait au Uno, au Monopoly et à la vie ? `toxique:2 chaos:1`
  en: Who'd cheat at Uno, at Monopoly and at life?
  es: ¿Quién haría trampas al Uno, al Monopoly y en la vida?
- Qui inventerait un décès dans sa famille pour éviter un truc ? `toxique:3 chaos:1`
  en: Who'd make up a death in the family to get out of something?
  es: ¿Quién se inventaría una muerte en la familia para librarse de algo?
- Qui garderait un secret même sous la torture ? `coeur:3`
  en: Who'd keep a secret even under torture?
  es: ¿Quién guardaría un secreto incluso bajo tortura?
- Qui craquerait et avouerait tout au premier verre ? `exces:3` #alcool
  en: Who'd crack and spill everything after one drink?
  es: ¿Quién se vendría abajo y lo cantaría todo a la primera copa?
- Qui aurait un groupe WhatsApp secret pour parler de nous ? `toxique:3`
  en: Who'd have a secret WhatsApp group to talk about us?
  es: ¿Quién tendría un grupo secreto de WhatsApp para hablar de nosotros?
- Qui mentirait sur son âge, sa taille ou ses diplômes ? `toxique:2 genance:2`
  en: Who'd lie about their age, their height or their degrees?
  es: ¿Quién mentiría sobre su edad, su altura o sus títulos?
- Qui vendrait nos dossiers à un magazine people ? `toxique:2 coeur:-2`
  en: Who'd sell our dirt to a gossip magazine?
  es: ¿Quién vendería nuestros trapos sucios a una revista del corazón?
- Qui dirait « j’arrive » alors qu’il est encore sous la douche ? `toxique:1 chaos:1`
  en: Who'd say "omw" while they're still in the shower?
  es: ¿Quién diría «ya llego» cuando todavía está en la ducha?
- Qui cacherait le plus de casseroles derrière son air innocent ? `toxique:2 chaos:2`
  en: Who'd have the most skeletons in their closet behind that innocent face?
  es: ¿Quién tendría el pasado más turbio detrás de esa cara de no haber roto un plato?
- Qui lirait le journal intime de quelqu’un ? `toxique:2 chaos:1`
  en: Who'd read someone's diary?
  es: ¿Quién leería el diario de alguien?
- Qui ferait un faux malaise pour sortir d’une situation gênante ? `genance:2 chaos:1`
  en: Who'd fake passing out to get out of an awkward situation?
  es: ¿Quién fingiría un desmayo para salir de una situación incómoda?
- Qui ferait semblant d’avoir lu un livre pour briller en soirée ? `genance:2 cerveau:-1`
  en: Who'd pretend they read a book just to look smart at a party?
  es: ¿Quién fingiría haber leído un libro para quedar bien en una fiesta?
- Qui raconterait tellement ses mythos qu’il finirait par y croire ? `genance:2 chaos:1`
  en: Who'd tell their BS stories so much they'd end up believing them?
  es: ¿Quién contaría tanto sus trolas que acabaría creyéndoselas?
- Qui ferait le meilleur agent double ? `cerveau:3 toxique:2`
  en: Who'd make the best double agent?
  es: ¿Quién sería el mejor agente doble?
- Qui se ferait griller parce que son histoire change à chaque fois ? `cerveau:-2 genance:2`
  en: Who'd get caught because their story changes every time?
  es: ¿A quién pillarían porque su historia cambia cada vez que la cuenta?
- Qui organiserait une soirée en cachette pour ne pas inviter quelqu’un ? `toxique:3 coeur:-1` #soiree
  en: Who'd throw a secret party just so they don't have to invite someone?
  es: ¿Quién montaría una fiesta a escondidas para no invitar a alguien?
- Qui simulerait sa propre mort pour échapper à ses dettes ? `chaos:3 toxique:1 cerveau:1`
  en: Who'd fake their own death to get out of their debts?
  es: ¿Quién fingiría su propia muerte para librarse de sus deudas?
- Qui aurait une addiction honteuse à un truc complètement nul ? `exces:2 genance:2`
  en: Who'd have an embarrassing addiction to something totally lame?
  es: ¿Quién tendría una adicción vergonzosa a una chorrada total?
- Qui revendrait les cadeaux qu’on lui offre ? `toxique:2 coeur:-1`
  en: Who'd resell the gifts people give them?
  es: ¿Quién revendería los regalos que le hacen?
- Qui ferait semblant d’être malade pour éviter l’anniversaire de quelqu’un ici ? `toxique:1 coeur:-2`
  en: Who'd fake being sick to skip the birthday of someone here?
  es: ¿Quién fingiría estar enfermo para no ir al cumple de alguien de aquí?
- Qui ferait l’ange devant les parents et le démon en soirée ? `exces:2 chaos:2 toxique:1` #soiree
  en: Who'd be an angel in front of the parents and a demon at parties?
  es: ¿Quién sería un angelito delante de los padres y un demonio de fiesta?
- Qui lirait les messages de quelqu’un par-dessus son épaule ? `toxique:2 chaos:1`
  en: Who'd read someone's texts over their shoulder?
  es: ¿Quién leería los mensajes de alguien por encima del hombro?
- Qui ferait semblant de connaître toutes les chansons en soirée ? `genance:2` #soiree
  en: Who'd pretend to know every song at parties?
  es: ¿Quién fingiría saberse todas las canciones en las fiestas?
- Qui inventerait un faux rendez-vous pour se barrer d’une soirée ? `toxique:1 chaos:1` #soiree
  en: Who'd make up a fake appointment to bail on a party?
  es: ¿Quién se inventaría un plan para pirarse de una fiesta?
- Qui oublierait tous les secrets qu’on lui raconte ? `cerveau:-2 exces:1`
  en: Who'd forget every secret people tell them?
  es: ¿Quién se olvidaría de todos los secretos que le cuentan?
- À qui tu confierais ton plus gros secret ? `coeur:3`
  en: Who would you trust with your biggest secret?
  es: ¿A quién le contarías tu mayor secreto?
- Qui tu choisirais pour couvrir un mensonge devant tes parents ? `cerveau:2 coeur:1`
  en: Who would you pick to cover for your lie in front of your parents?
  es: ¿A quién elegirías para cubrir una mentira delante de tus padres?
- À qui tu demanderais un alibi en béton ? `cerveau:2 coeur:1`
  en: Who would you ask for a rock solid alibi?
  es: ¿A quién le pedirías una coartada a prueba de bomba?
- Qui tu soupçonnerais en premier si un secret fuitait ? `toxique:2 coeur:-2`
  en: Who would you suspect first if a secret leaked?
  es: ¿De quién sospecharías primero si se filtrara un secreto?

## 📱 Réseaux & Téléphone
<!-- id: reseaux -->
<!-- en: Socials & Phones -->
<!-- es: Redes y móvil -->
> Insta, Tinder, WhatsApp et vocaux de 7 minutes.
> en: Insta, Tinder, WhatsApp and 7-minute voice notes.
> es: Insta, Tinder, WhatsApp y audios de 7 minutos.

- Qui aurait le temps d’écran le plus honteux ? `exces:3`
  en: Who'd have the most embarrassing screen time?
  es: ¿Quién tendría el tiempo de pantalla más vergonzoso?
- Qui likerait par erreur une vieille photo en stalkant quelqu’un ? `genance:3 chaos:1`
  en: Who'd accidentally like an old pic while stalking someone?
  es: ¿Quién daría like sin querer a una foto antigua stalkeando a alguien?
- Qui screenshoterait les conversations du groupe pour les envoyer ailleurs ? `toxique:3`
  en: Who'd screenshot the group chat to send it somewhere else?
  es: ¿Quién haría capturas del chat del grupo para mandarlas a otro sitio?
- Qui posterait des citations motivantes après une rupture ? `genance:3`
  en: Who'd post motivational quotes after a breakup?
  es: ¿Quién subiría frases motivadoras después de una ruptura?
- Qui achèterait des followers ? `genance:3 toxique:1`
  en: Who'd buy followers?
  es: ¿Quién compraría seguidores?
- Qui aurait le plus de matchs Tinder et zéro rendez-vous ? `hot:1 genance:2` #celib
  en: Who'd have the most Tinder matches and zero dates?
  es: ¿Quién tendría más matches en Tinder y cero citas?
- Qui enverrait des vocaux de 7 minutes ? `genance:2 chaos:1`
  en: Who'd send 7-minute voice notes?
  es: ¿Quién mandaría audios de 7 minutos?
- Qui écrirait des légendes Insta de trois paragraphes ? `genance:2`
  en: Who'd write three-paragraph Insta captions?
  es: ¿Quién escribiría pies de foto de tres párrafos en Insta?
- Qui aurait un faux compte pour stalker tranquillement ? `toxique:2 genance:1`
  en: Who'd have a fake account to stalk people in peace?
  es: ¿Quién tendría una cuenta falsa para stalkear tranquilamente?
- Qui posterait 15 stories de la même soirée, toutes floues ? `exces:2 genance:2`
  en: Who'd post 15 stories of the same night, all blurry?
  es: ¿Quién subiría 15 stories de la misma noche, todas borrosas?
- Qui regarderait les stories de son ex en premier ? `genance:2 toxique:1`
  en: Who'd watch their ex's stories first?
  es: ¿Quién vería primero las stories de su ex?
- Qui retoucherait ses photos au point d’être méconnaissable ? `genance:2 toxique:1`
  en: Who'd edit their pics so much they're unrecognizable?
  es: ¿Quién retocaría sus fotos hasta quedar irreconocible?
- Qui serait le plus différent en vrai que sur ses photos ? `hot:-1 toxique:1 genance:1`
  en: Who'd be the most different IRL than in their pics?
  es: ¿Quién sería más diferente en persona que en sus fotos?
- Qui lirait la conversation du groupe sans jamais répondre ? `toxique:2`
  en: Who'd read the group chat and never reply?
  es: ¿Quién leería el chat del grupo sin contestar nunca?
- Qui répondrait « mdr » sans jamais rire ? `toxique:1`
  en: Who'd reply "lol" without ever actually laughing?
  es: ¿Quién respondería «jajaja» sin reírse nunca?
- Qui enverrait un message bourré qu’il regretterait toute sa vie ? `exces:3 genance:2` #alcool
  en: Who'd send a drunk text they'd regret for the rest of their life?
  es: ¿Quién mandaría un mensaje borracho del que se arrepentiría toda la vida?
- Qui pourrait se faire cancel pour un vieux tweet ? `toxique:2 chaos:2`
  en: Who could get canceled over an old tweet?
  es: ¿A quién podrían cancelar por un tuit antiguo?
- Qui commenterait les posts de sa famille avec trop d’émojis ? `genance:3`
  en: Who'd comment on their family's posts with way too many emojis?
  es: ¿Quién comentaría los posts de su familia con demasiados emojis?
- Qui serait sur son téléphone même à un enterrement ? `exces:2 toxique:1`
  en: Who'd be on their phone even at a funeral?
  es: ¿Quién estaría con el móvil hasta en un entierro?
- Qui supprimerait ses posts s’ils n’ont pas assez de likes ? `genance:2`
  en: Who'd delete their posts if they don't get enough likes?
  es: ¿Quién borraría sus posts si no tienen suficientes likes?
- Qui ferait un live TikTok en pleine dispute de couple ? `chaos:3 genance:2` #couple
  en: Who'd go live on TikTok in the middle of a fight with their bf or gf?
  es: ¿Quién haría un directo en TikTok en plena bronca de pareja?
- Qui aurait la pire playlist Spotify ? `genance:2 cerveau:-1`
  en: Who'd have the worst Spotify playlist?
  es: ¿Quién tendría la peor playlist de Spotify?
- Qui retrouverait le compte Insta de n’importe qui en 5 minutes ? `cerveau:2 toxique:1`
  en: Who'd find anybody's Insta in 5 minutes?
  es: ¿Quién encontraría el Insta de cualquiera en 5 minutos?
- Qui aurait le plus de messages non lus ? `chaos:2 toxique:1`
  en: Who'd have the most unread messages?
  es: ¿Quién tendría más mensajes sin leer?
- Qui changerait de photo de profil à chaque rupture ? `genance:2 chaos:1`
  en: Who'd change their profile pic after every breakup?
  es: ¿Quién cambiaría de foto de perfil con cada ruptura?
- Qui emmènerait son téléphone aux toilettes à chaque fois ? `exces:2`
  en: Who'd take their phone to the toilet every single time?
  es: ¿Quién se llevaría el móvil al baño cada vez que va?
- Qui posterait une story pour la supprimer cinq minutes après ? `genance:2 exces:1`
  en: Who'd post a story just to delete it five minutes later?
  es: ¿Quién subiría una story para borrarla cinco minutos después?
- Qui spammerait le groupe de memes à 3h du matin ? `chaos:2 exces:1`
  en: Who'd spam the group chat with memes at 3am?
  es: ¿Quién spamearía el grupo con memes a las 3 de la mañana?
- Qui relirait ses anciennes conversations pour savoir à quel moment ça a dérapé ? `genance:2`
  en: Who'd reread their old convos to figure out exactly when it all went wrong?
  es: ¿Quién releería sus conversaciones antiguas para saber en qué momento se torció todo?
- Qui aurait des screens compromettants sur tout le monde ? `toxique:3 cerveau:1`
  en: Who'd have incriminating screenshots on everybody?
  es: ¿Quién tendría capturas comprometedoras de todo el mundo?
- À qui tu laisserais ton téléphone déverrouillé ? `coeur:3`
  en: Who would you leave your phone unlocked with?
  es: ¿A quién le dejarías el móvil desbloqueado?
- Qui tu choisirais pour gérer ton Insta pendant une semaine ? `cerveau:2 hot:1`
  en: Who would you pick to run your Insta for a week?
  es: ¿A quién elegirías para llevar tu Insta durante una semana?
- Qui tu laisserais choisir tes photos Tinder ? `hot:2 cerveau:1` #celib
  en: Who would you let pick your Tinder pics?
  es: ¿A quién dejarías elegir tus fotos de Tinder?
- Qui tu laisserais jamais toucher à ton téléphone ? `toxique:2 coeur:-1`
  en: Who would you never let touch your phone?
  es: ¿A quién no dejarías nunca tocar tu móvil?

## 🏆 Ego & Compétition
<!-- id: ego -->
<!-- en: Ego & Competition -->
<!-- es: Ego y competición -->
> Mauvais perdants et gros egos.
> en: Sore losers and big egos.
> es: Malos perdedores y egos enormes.

- Qui retournerait le plateau en perdant au Monopoly ? `chaos:3 toxique:2`
  en: Who'd flip the board after losing at Monopoly?
  es: ¿Quién tiraría el tablero por los aires al perder al Monopoly?
- Qui serait le plus mauvais perdant du groupe ? `toxique:3`
  en: Who'd be the sorest loser in the group?
  es: ¿Quién sería el peor perdedor del grupo?
- Qui se trouverait le plus beau du groupe ? `toxique:2 genance:1`
  en: Who'd think they're the best looking in the group?
  es: ¿Quién se creería el más guapo del grupo?
- Qui reconnaîtrait jamais avoir tort, même avec les preuves sous les yeux ? `toxique:3 cerveau:-1`
  en: Who'd never admit they're wrong, even with the proof right in front of them?
  es: ¿Quién nunca admitiría que se equivoca, ni con las pruebas delante de las narices?
- Qui ramènerait toujours tout à lui ? `toxique:3`
  en: Who'd always make everything about themselves?
  es: ¿Quién acabaría siempre hablando de sí mismo?
- Qui raconterait ses exploits sportifs d’il y a dix ans comme si c’était hier ? `genance:3` #sport
  en: Who'd brag about their sports glory days from ten years ago like it was yesterday?
  es: ¿Quién contaría sus hazañas deportivas de hace diez años como si fueran de ayer?
- Qui se prendrait pour un coach dès qu’il touche un ballon ? `genance:2 toxique:1` #sport
  en: Who'd think they're a coach the second they touch a ball?
  es: ¿Quién se creería entrenador nada más tocar un balón?
- Qui se blesserait en voulant impressionner tout le monde au foot ? `genance:2 chaos:1 cerveau:-1` #sport
  en: Who'd get hurt trying to impress everyone at soccer?
  es: ¿Quién se lesionaría jugando al fútbol por querer lucirse?
- Qui se croirait plus intelligent que tout le monde ici ? `toxique:2 genance:1`
  en: Who'd think they're smarter than everyone here?
  es: ¿Quién se creería más listo que todos los demás?
- Qui gagnerait un quiz de culture générale ? `cerveau:3`
  en: Who'd win a general trivia quiz?
  es: ¿Quién ganaría un trivial de cultura general?
- Qui péterait un câble en perdant au beer-pong ? `exces:2 toxique:2` #alcool
  en: Who'd totally lose it after losing at beer pong?
  es: ¿A quién se le iría la olla al perder al beer pong?
- Qui transformerait un simple bowling en guerre froide ? `chaos:2 toxique:2`
  en: Who'd turn a chill bowling night into a cold war?
  es: ¿Quién convertiría una simple partida de bolos en una guerra fría?
- Qui quitterait une partie de jeu vidéo en rage ? `chaos:2 toxique:1` #gaming
  en: Who'd rage quit a video game?
  es: ¿Quién dejaría una partida a medias de la rabia?
- Qui serait prêt à perdre un pote pour gagner un jeu ? `toxique:2 coeur:-2`
  en: Who'd be ready to lose a friend just to win a game?
  es: ¿Quién estaría dispuesto a perder a un colega con tal de ganar una partida?
- Qui se vanterait de son salaire sans qu’on lui demande ? `toxique:2 genance:2`
  en: Who'd brag about their salary without anyone asking?
  es: ¿Quién fardaría de sueldo sin que nadie le pregunte?
- Qui se dirait « entrepreneur » avec zéro client ? `genance:3 cerveau:-1`
  en: Who'd call themselves an "entrepreneur" with zero clients?
  es: ¿Quién diría que es «emprendedor» con cero clientes?
- Qui prendrait le plus le melon s’il devenait célèbre ? `toxique:3 exces:1`
  en: Who'd get the biggest head if they got famous?
  es: ¿A quién se le subiría más la fama a la cabeza?
- Qui perdrait tout le temps en disant que « le jeu est nul » ? `genance:2 toxique:1 cerveau:-1`
  en: Who'd lose all the time and say "this game sucks"?
  es: ¿Quién perdería todo el rato diciendo que «este juego es una mierda»?
- Qui boirait plus que tout le monde juste pour prouver quelque chose ? `exces:3 chaos:1` #alcool
  en: Who'd drink more than everyone just to prove something?
  es: ¿Quién bebería más que nadie solo para demostrar algo?
- Qui deviendrait insupportable s’il gagnait au Loto ? `toxique:2 exces:2`
  en: Who'd become unbearable if they won the lottery?
  es: ¿Quién se volvería insoportable si le tocara la lotería?
- Qui corrigerait l’orthographe des autres dans le groupe ? `cerveau:2 toxique:1`
  en: Who'd correct everyone's spelling in the group chat?
  es: ¿Quién corregiría la ortografía de los demás en el grupo?
- Qui s’entraînerait en secret pour nous battre au prochain tournoi ? `cerveau:1 genance:2`
  en: Who'd secretly train to beat us at the next tournament?
  es: ¿Quién entrenaría en secreto para ganarnos en el próximo torneo?
- Qui publierait son temps de course sur Strava chaque matin ? `genance:2 hot:1` #sport
  en: Who'd post their run time on Strava every morning?
  es: ¿Quién publicaría su tiempo de carrera en Strava todas las mañanas?
- Qui aurait toujours une histoire encore plus folle que la tienne ? `toxique:2`
  en: Who'd always have a story even crazier than yours?
  es: ¿Quién tendría siempre una historia aún más loca que la tuya?
- Qui contesterait l’arbitrage d’un Time’s Up pendant 20 minutes ? `toxique:2 chaos:1`
  en: Who'd argue over a call in Time's Up for 20 minutes?
  es: ¿Quién se pasaría 20 minutos discutiendo una decisión en el Time’s Up?
- Qui se regarderait dans tous les miroirs qu’il croise ? `hot:1 toxique:1 genance:1`
  en: Who'd check themselves out in every mirror they walk past?
  es: ¿Quién se miraría en todos los espejos que se encuentra?
- Qui gagnerait une bagarre contre tout le groupe ? `chaos:2 hot:1`
  en: Who'd win a fight against the whole group?
  es: ¿Quién ganaría una pelea contra todo el grupo?
- Qui serait le plus beau joueur ? `coeur:2 cerveau:1`
  en: Who'd be the best sport?
  es: ¿Quién sería el que mejor sabe perder?
- Qui penserait pouvoir battre un pro dans son propre sport ? `genance:2 cerveau:-2` #sport
  en: Who'd think they could beat a pro at their own sport?
  es: ¿Quién pensaría que puede ganar a un profesional en su propio deporte?
- Qui voterait pour lui-même à ce jeu ? `toxique:2`
  en: Who'd vote for themselves in this game?
  es: ¿Quién se votaría a sí mismo en este juego?
- Qui tu choisirais en premier dans ton équipe au foot ? `hot:1` #sport
  en: Who would you pick first for your soccer team?
  es: ¿A quién elegirías primero para tu equipo de fútbol?
- Avec qui tu ferais équipe pour gagner au Pictionary ? `cerveau:2`
  en: Who would you team up with to win at Pictionary?
  es: ¿Con quién harías equipo para ganar al Pictionary?
- Qui tu voudrais jamais avoir comme adversaire au Monopoly ? `toxique:2 cerveau:1`
  en: Who would you never want to play against at Monopoly?
  es: ¿A quién no querrías nunca de rival en el Monopoly?
- Qui tu choisirais comme coach pour te remettre en forme ? `cerveau:1 hot:2` #sport
  en: Who would you pick as your coach to get back in shape?
  es: ¿A quién elegirías como entrenador para ponerte en forma?
- Qui irait à la salle juste pour les selfies dans le miroir ? `genance:2 hot:1` #sport
  en: Who’d go to the gym just for mirror selfies?
  es: ¿Quién iría al gimnasio solo por los selfies en el espejo?
- Qui parlerait de ses records à la salle à chaque repas ? `genance:2` #sport
  en: Who’d bring up their gym PRs at every meal?
  es: ¿Quién hablaría de sus marcas en el gimnasio en cada comida?
- Qui abandonnerait son abonnement à la salle au bout d’une semaine ? `genance:1 exces:-1` #sport
  en: Who’d give up their gym membership after a week?
  es: ¿Quién se daría de baja del gimnasio a la semana?
- Qui serait l’arbitre le plus de mauvaise foi d’un match entre potes ? `toxique:1 chaos:1` #sport
  en: Who’d be the most biased ref in a match between mates?
  es: ¿Quién sería el árbitro más parcial de un partido entre colegas?

## 🚔 Crime & Police
<!-- id: crime -->
<!-- en: Crime & Cops -->
<!-- es: Crimen y polis -->
> Garde à vue, arnaques et casiers judiciaires.
> en: Getting locked up, scams and rap sheets.
> es: Calabozos, estafas y antecedentes penales.

- Qui ferait le meilleur pickpocket ? `cerveau:2 toxique:2`
  en: Who'd make the best pickpocket?
  es: ¿Quién sería el mejor carterista?
- Qui organiserait le braquage parfait ? `cerveau:3 chaos:1`
  en: Who'd plan the perfect heist?
  es: ¿Quién planearía el atraco perfecto?
- Qui se ferait arrêter à l’étranger pour un truc complètement débile ? `chaos:2 genance:2 cerveau:-1`
  en: Who'd get arrested abroad for something totally dumb?
  es: ¿A quién detendrían en el extranjero por una chorrada total?
- Qui aurait l’alibi le plus pourri ? `genance:2 cerveau:-2`
  en: Who'd have the crappiest alibi?
  es: ¿Quién tendría la coartada más cutre?
- Qui volerait un truc dans un magasin juste pour le frisson ? `toxique:2 chaos:1`
  en: Who'd steal something from a store just for the thrill?
  es: ¿Quién robaría algo en una tienda solo por el subidón?
- Qui finirait en cellule de dégrisement ? `exces:3 chaos:2` #alcool
  en: Who'd end up in the drunk tank?
  es: ¿Quién acabaría en el calabozo por ir pedo?
- Qui serait le plus doué pour s’évader de prison ? `cerveau:2 chaos:2`
  en: Who'd be the best at breaking out of prison?
  es: ¿A quién se le daría mejor fugarse de la cárcel?
- Qui lancerait une arnaque crypto sur ses propres potes ? `toxique:3 coeur:-2`
  en: Who'd run a crypto scam on their own friends?
  es: ¿Quién les montaría una estafa cripto a sus propios colegas?
- Qui craquerait en interrogatoire au bout de trente secondes ? `genance:2 cerveau:-1`
  en: Who'd crack under interrogation after thirty seconds?
  es: ¿Quién se vendría abajo en un interrogatorio a los treinta segundos?
- Qui aurait un casier long comme le bras s’il s’était fait choper pour tout ? `chaos:3 exces:1`
  en: Who'd have a rap sheet a mile long if they'd got caught for everything?
  es: ¿Quién tendría unos antecedentes kilométricos si le hubieran pillado por todo?
- Qui serait le meilleur avocat pour nous sortir de prison ? `cerveau:3 coeur:1`
  en: Who'd be the best lawyer to get us out of jail?
  es: ¿Quién sería el mejor abogado para sacarnos de la cárcel?
- Qui pourrait faire disparaître un corps sans laisser de trace ? `cerveau:2 toxique:2`
  en: Who could make a body disappear without a trace?
  es: ¿Quién podría hacer desaparecer un cadáver sin dejar rastro?
- Qui fumerait un joint juste devant une voiture de police ? `exces:2 chaos:2 cerveau:-1`
  en: Who'd smoke a joint right in front of a cop car?
  es: ¿Quién se fumaría un porro justo delante de un coche de policía?
- Qui frauderait le métro pendant des années en s’en vantant ? `toxique:1 chaos:2`
  en: Who'd skip paying for the subway for years and brag about it?
  es: ¿Quién se colaría en el metro durante años y encima fardaría de ello?
- Qui tomberait amoureux en prison ? `chaos:2 hot:1`
  en: Who'd fall in love in prison?
  es: ¿Quién se enamoraría en la cárcel?
- Qui deviendrait le caïd de la prison en une semaine ? `toxique:2 chaos:2`
  en: Who'd be running the prison within a week?
  es: ¿Quién mandaría en la cárcel en una semana?
- Qui se ferait choper à la douane avec un truc interdit dans sa valise ? `exces:2 cerveau:-2 chaos:1`
  en: Who'd get busted at customs with something illegal in their suitcase?
  es: ¿A quién pillarían en la aduana con algo prohibido en la maleta?
- Qui serait un indic sans que personne s’en doute ? `toxique:2 coeur:-2`
  en: Who'd be a snitch for the cops without anyone suspecting a thing?
  es: ¿Quién sería un chivato de la poli sin que nadie se lo oliera?
- Qui insulterait un flic pendant un simple contrôle ? `chaos:3 cerveau:-1`
  en: Who'd insult a cop during a routine stop?
  es: ¿Quién insultaría a un poli en un simple control?
- Qui pourrait commettre un crime et pleurer le plus fort à l’enterrement ? `toxique:3 cerveau:1`
  en: Who could commit a crime and cry the loudest at the funeral?
  es: ¿Quién podría cometer un crimen y llorar más que nadie en el funeral?
- Qui mentirait à un flic en le regardant droit dans les yeux ? `toxique:2 cerveau:1`
  en: Who'd lie to a cop while looking them dead in the eye?
  es: ¿Quién le mentiría a un poli mirándole fijamente a los ojos?
- Qui finirait dans un docu Netflix sur les arnaqueurs ? `toxique:2 chaos:2 cerveau:1`
  en: Who'd end up in a Netflix doc about scammers?
  es: ¿Quién acabaría saliendo en un docu de Netflix sobre estafadores?
- Qui se ferait arnaquer par un faux conseiller bancaire au téléphone ? `cerveau:-2 genance:2`
  en: Who'd get scammed over the phone by a fake bank guy?
  es: ¿A quién timaría por teléfono un falso empleado del banco?
- Qui conduirait comme s’il avait déjà perdu tous ses points ? `chaos:2 exces:1` #voiture
  en: Who'd drive like they've already lost their license?
  es: ¿Quién conduciría como si ya hubiera perdido todos los puntos del carnet?
- Qui essaierait de draguer le gendarme pour éviter son PV ? `hot:2 chaos:2`
  en: Who'd try to flirt with the cop to get out of a ticket?
  es: ¿Quién intentaría ligar con el guardia civil para librarse de la multa?
- Qui pisserait dans la rue juste devant des flics ? `exces:2 genance:2 chaos:1`
  en: Who'd piss in the street right in front of cops?
  es: ¿Quién mearía en la calle justo delante de la poli?
- Qui utiliserait encore le compte Netflix de son ex en cachette ? `toxique:2`
  en: Who'd still be secretly using their ex's Netflix account?
  es: ¿Quién seguiría usando a escondidas la cuenta de Netflix de su ex?
- Qui finirait au mitard dès la première semaine ? `chaos:3 toxique:1`
  en: Who'd end up in solitary the very first week?
  es: ¿Quién acabaría en aislamiento ya la primera semana?
- Qui simulerait un braquage en live sur TikTok pour les vues ? `genance:3 chaos:2`
  en: Who'd fake a robbery live on TikTok for the views?
  es: ¿Quién fingiría un atraco en directo en TikTok por las visitas?
- Qui se ferait expulser d’un pays pour tapage nocturne ? `exces:2 chaos:2`
  en: Who'd get kicked out of a country over a noise complaint?
  es: ¿A quién echarían de un país por armar jaleo de noche?
- Qui tu appellerais pour t’aider à cacher un corps ? `coeur:3 cerveau:1`
  en: Who would you call to help you hide a body?
  es: ¿A quién llamarías para que te ayudara a esconder un cadáver?
- Qui tu choisirais comme complice ? `cerveau:2 coeur:1`
  en: Who would you pick as your partner in crime?
  es: ¿A quién elegirías como cómplice?
- Qui tu appellerais en premier depuis la garde à vue ? `coeur:2 cerveau:1`
  en: Who would you call first from lockup?
  es: ¿A quién llamarías primero desde el calabozo?
- À qui tu ferais confiance pour garder le butin ? `coeur:2`
  en: Who would you trust to hold onto the loot?
  es: ¿En quién confiarías para guardar el botín?

## ✈️ Voyages & Vacances
<!-- id: voyages -->
<!-- en: Trips & Vacations -->
<!-- es: Viajes y vacaciones -->
> Les vacances entre potes et leurs galères.
> en: Trips with friends and everything that goes wrong.
> es: Las vacaciones con colegas y todos sus marrones.

- Qui perdrait son passeport dès le premier jour ? `genance:2 cerveau:-2 chaos:1`
  en: Who'd lose their passport on day one?
  es: ¿Quién perdería el pasaporte el primer día?
- Avec qui tu partagerais jamais une chambre ? `genance:2 toxique:2`
  en: Who would you never share a room with?
  es: ¿Con quién no compartirías nunca habitación?
- Qui raterait son avion parce qu’il était encore au bar de l’aéroport ? `exces:3 chaos:1`
  en: Who'd miss their flight because they were still at the airport bar?
  es: ¿Quién perdería el avión por seguir en el bar del aeropuerto?
- Qui reviendrait de vacances avec un tatouage qu’il regrette déjà ? `chaos:3 exces:1`
  en: Who'd come back from vacation with a tattoo they already regret?
  es: ¿Quién volvería de vacaciones con un tatuaje del que ya se arrepiente?
- Qui aurait une amourette de vacances dès le deuxième soir ? `hot:3 chaos:1`
  en: Who'd have a vacation fling by the second night?
  es: ¿Quién tendría un rollo de vacaciones ya la segunda noche?
- Qui ferait un planning à l’heure près pour des vacances ? `cerveau:2 chaos:-2`
  en: Who'd make an hour-by-hour schedule for a vacation?
  es: ¿Quién haría un planning de las vacaciones hora por hora?
- Qui ferait sa valise une heure avant de partir ? `chaos:2 cerveau:-1`
  en: Who'd pack an hour before leaving?
  es: ¿Quién haría la maleta una hora antes de salir?
- Qui se plaindrait de tout du début à la fin du séjour ? `toxique:3`
  en: Who'd complain about everything from the start to the end of the trip?
  es: ¿Quién se quejaría de todo de principio a fin del viaje?
- Qui parlerait anglais avec l’accent le plus gênant ? `genance:3 cerveau:-1`
  en: Who'd have the most cringe accent speaking another language?
  es: ¿Quién hablaría inglés con el acento que más vergüenza ajena da?
- Qui finirait avec le pire coup de soleil ? `genance:2 cerveau:-1`
  en: Who'd end up with the worst sunburn?
  es: ¿Quién pillaría la peor quemadura de sol?
- Qui claquerait tout son budget dès le premier soir ? `exces:3 cerveau:-1`
  en: Who'd blow their whole budget on the first night?
  es: ¿Quién se fundiría todo el presupuesto la primera noche?
- Qui dirait « je te rembourse » sans jamais le faire ? `toxique:3`
  en: Who'd say "I'll pay you back" and never do it?
  es: ¿Quién diría «ya te lo devuelvo» y nunca lo haría?
- Qui se ferait arnaquer par le premier chauffeur de taxi venu ? `cerveau:-2`
  en: Who'd get ripped off by the first taxi driver they see?
  es: ¿A quién timaría el primer taxista que se cruzara?
- Qui aurait les pieds qui puent le plus après une rando ? `genance:3`
  en: Who'd have the smelliest feet after a hike?
  es: ¿A quién le olerían más los pies después de una ruta?
- Qui ramènerait quelqu’un dans la chambre qu’on partage ? `hot:2 toxique:2 chaos:1`
  en: Who'd bring someone back to the room we're sharing?
  es: ¿Quién se traería a alguien a la habitación que compartimos?
- Qui partirait faire le tour du monde sur un coup de tête ? `chaos:3`
  en: Who'd take off to travel the world on a whim?
  es: ¿Quién se iría a dar la vuelta al mundo de un día para otro?
- Qui posterait 300 stories par jour pendant ses vacances ? `genance:2 exces:1`
  en: Who'd post 300 stories a day on vacation?
  es: ¿Quién subiría 300 stories al día en vacaciones?
- Qui vomirait dans le bus pendant l’excursion ? `exces:2 genance:2`
  en: Who'd puke on the bus during the day trip?
  es: ¿Quién potaría en el bus durante la excursión?
- Qui voudrait tout plaquer pour son amour de vacances ? `hot:2 chaos:2 cerveau:-1`
  en: Who'd want to drop everything for their vacation fling?
  es: ¿Quién querría dejarlo todo por su amor de verano?
- Qui oublierait un truc essentiel dans sa valise ? `cerveau:-1 chaos:1`
  en: Who'd forget to pack something essential?
  es: ¿Quién se dejaría algo imprescindible al hacer la maleta?
- Qui finirait la soirée aux urgences d’un pays étranger ? `exces:3 chaos:2`
  en: Who'd end the night in the ER in a foreign country?
  es: ¿Quién acabaría la noche en urgencias en un país extranjero?
- Qui mangerait au McDo dans chaque pays visité ? `genance:2 cerveau:-1 exces:1`
  en: Who'd eat at McDonald's in every country they visit?
  es: ¿Quién comería en el McDonald's en cada país que visitara?
- Qui serait le meilleur guide de voyage du groupe ? `cerveau:3 coeur:1`
  en: Who'd be the best tour guide in the group?
  es: ¿Quién sería el mejor guía turístico del grupo?
- Qui ronflerait le plus fort ? `genance:3`
  en: Who'd snore the loudest?
  es: ¿Quién roncaría más fuerte?
- Qui ferait la gueule toute la journée parce qu’on n’a pas suivi son planning ? `toxique:3`
  en: Who'd sulk all day because we didn't stick to their schedule?
  es: ¿Quién estaría de morros todo el día porque no seguimos su planning?
- Qui arriverait à se perdre dans un village de 2000 habitants ? `cerveau:-2`
  en: Who'd manage to get lost in a village of 2000 people?
  es: ¿Quién conseguiría perderse en un pueblo de 2000 habitantes?
- Qui finirait à poil dans la piscine dès le premier soir ? `chaos:2 exces:2 hot:1`
  en: Who'd end up butt naked in the pool on the first night?
  es: ¿Quién acabaría en pelotas en la piscina ya la primera noche?
- Qui reviendrait de vacances plus fatigué qu’en partant ? `exces:2 chaos:1`
  en: Who'd come back from vacation more tired than when they left?
  es: ¿Quién volvería de vacaciones más cansado que cuando se fue?
- Qui annulerait le voyage la veille du départ ? `toxique:3 chaos:1`
  en: Who'd cancel the trip the day before we leave?
  es: ¿Quién cancelaría el viaje el día antes de salir?
- Qui nous ferait perdre la caution de l’Airbnb ? `exces:2 chaos:1 toxique:1`
  en: Who'd make us lose the Airbnb deposit?
  es: ¿Por culpa de quién perderíamos la fianza del Airbnb?
- Avec qui tu partirais en road trip ? `coeur:2 chaos:1`
  en: Who would you go on a road trip with?
  es: ¿Con quién te irías de road trip?
- À qui tu confierais l’organisation des vacances ? `cerveau:3 chaos:-1`
  en: Who would you trust to plan the vacation?
  es: ¿A quién le dejarías organizar las vacaciones?
- À qui tu confierais les passeports de tout le groupe ? `cerveau:2 coeur:1 chaos:-1`
  en: Who would you trust with the whole group's passports?
  es: ¿A quién le confiarías los pasaportes de todo el grupo?
- Avec qui tu partagerais ta tente en festival ? `coeur:2 exces:1`
  en: Who would you share your tent with at a festival?
  es: ¿Con quién compartirías tienda en un festival?

## 🪞 Personnalité
<!-- id: personnalite -->
<!-- en: Personality -->
<!-- es: Personalidad -->
> Qui est quoi, vraiment.
> en: Who's what, for real.
> es: Quién es qué, pero de verdad.

- Qui est le plus intelligent d’entre nous ? `cerveau:3`
  en: Who's the smartest of us all?
  es: ¿Quién es el más listo de todos nosotros?
- Qui est le plus drôle du groupe ? `cerveau:1 chaos:1`
  en: Who's the funniest in the group?
  es: ¿Quién es el más gracioso del grupo?
- Qui est le plus généreux ? `coeur:3`
  en: Who's the most generous?
  es: ¿Quién es el más generoso?
- Qui est le plus têtu ? `toxique:2`
  en: Who's the most stubborn?
  es: ¿Quién es el más cabezota?
- Qui est le plus naïf ? `cerveau:-2 genance:1`
  en: Who's the most naive?
  es: ¿Quién es el más ingenuo?
- Qui est le plus mature ? `cerveau:2 chaos:-2`
  en: Who's the most mature?
  es: ¿Quién es el más maduro?
- Qui est le plus immature ? `chaos:2 genance:1 cerveau:-1`
  en: Who's the most immature?
  es: ¿Quién es el más inmaduro?
- Qui est le plus sensible ? `coeur:2`
  en: Who's the most sensitive?
  es: ¿Quién es el más sensible?
- Qui est le plus charismatique ? `hot:2 cerveau:1`
  en: Who's the most charismatic?
  es: ¿Quién tiene más carisma?
- Qui est le plus loyal ? `coeur:3`
  en: Who's the most loyal?
  es: ¿Quién es el más leal?
- Qui est le plus rancunier ? `toxique:3`
  en: Who holds the biggest grudges?
  es: ¿Quién es el más rencoroso?
- Qui est le plus optimiste ? `coeur:1 chaos:1`
  en: Who's the most optimistic?
  es: ¿Quién es el más optimista?
- Qui est le plus pessimiste ? `toxique:1`
  en: Who's the most pessimistic?
  es: ¿Quién es el más pesimista?
- Qui est le plus timide ? `genance:2 hot:-1`
  en: Who's the shyest?
  es: ¿Quién es el más tímido?
- Qui est le plus sûr de lui ? `hot:2 toxique:1`
  en: Who's the most confident?
  es: ¿Quién es el más seguro de sí mismo?
- Qui est le plus organisé ? `cerveau:2 chaos:-2`
  en: Who's the most organized?
  es: ¿Quién es el más organizado?
- Qui est le plus bordélique ? `chaos:3`
  en: Who's the messiest?
  es: ¿Quién es el más desastre?
- Qui est le plus créatif ? `cerveau:2 chaos:1`
  en: Who's the most creative?
  es: ¿Quién es el más creativo?
- Qui est le plus dramatique ? `chaos:2 genance:2`
  en: Who's the most dramatic?
  es: ¿Quién es el más dramático?
- Qui est le plus calme en toutes circonstances ? `chaos:-2 cerveau:1`
  en: Who's the calmest no matter what?
  es: ¿Quién mantiene más la calma pase lo que pase?
- Qui est le plus impulsif ? `chaos:3`
  en: Who's the most impulsive?
  es: ¿Quién es el más impulsivo?
- Qui est le plus curieux ? `cerveau:2`
  en: Who's the most curious?
  es: ¿Quién es el más curioso?
- Qui est le plus paresseux ? `exces:2 cerveau:-1`
  en: Who's the laziest?
  es: ¿Quién es el más vago?
- Qui est le plus ambitieux ? `cerveau:2 toxique:1`
  en: Who's the most ambitious?
  es: ¿Quién es el más ambicioso?
- Qui est le plus sociable ? `exces:1 coeur:1 hot:1`
  en: Who's the most outgoing?
  es: ¿Quién es el más sociable?
- Qui est le plus mystérieux ? `hot:2 cerveau:1`
  en: Who's the most mysterious?
  es: ¿Quién es el más misterioso?
- Qui est le plus égoïste ? `toxique:3 coeur:-2`
  en: Who's the most selfish?
  es: ¿Quién es el más egoísta?
- Qui a le meilleur fond ? `coeur:3`
  en: Who's the best person deep down?
  es: ¿Quién es mejor persona en el fondo?
- À qui tu demanderais conseil pour une grosse décision ? `cerveau:3 coeur:1`
  en: Who would you ask for advice on a big decision?
  es: ¿A quién le pedirías consejo para una decisión importante?
- Sur qui tu pourrais compter à 4h du matin ? `coeur:3`
  en: Who could you count on at 4am?
  es: ¿Con quién podrías contar a las 4 de la mañana?
- Qui est le pilier du groupe ? `coeur:3`
  en: Who holds the group together?
  es: ¿Quién es el pilar del grupo?
- Qui donne les meilleurs conseils ? `coeur:2 cerveau:1`
  en: Who gives the best advice?
  es: ¿Quién da los mejores consejos?
- Qui a le plus changé depuis qu’on se connaît ? `coeur:1`
  en: Who’s changed the most since we met?
  es: ¿Quién ha cambiado más desde que nos conocemos?
- Qui ferait le meilleur prof ? `cerveau:2 coeur:1`
  en: Who’d make the best teacher?
  es: ¿Quién sería el mejor profe?

## 🧩 Traits & Manies
<!-- id: traits -->
<!-- en: Quirks & Habits -->
<!-- es: Manías y costumbres -->
> Les petites habitudes qui nous rendent fous.
> en: The little habits that drive us nuts.
> es: Las pequeñas manías que nos sacan de quicio.

- Qui s’énerve le plus facilement ? `toxique:2 chaos:1`
  en: Who gets pissed off the easiest?
  es: ¿Quién se cabrea más fácilmente?
- Qui est toujours en retard ? `chaos:2 toxique:1`
  en: Who's always late?
  es: ¿Quién llega siempre tarde?
- Qui parle le plus fort ? `genance:2 chaos:1`
  en: Who talks the loudest?
  es: ¿Quién habla más alto?
- Qui coupe tout le temps la parole ? `toxique:2`
  en: Who's always cutting people off?
  es: ¿Quién interrumpe todo el rato?
- Qui râle le plus ? `toxique:2`
  en: Who bitches the most?
  es: ¿Quién se queja más?
- Qui rigole le plus facilement ? `coeur:1 chaos:1`
  en: Who laughs the easiest?
  es: ¿Quién se ríe con más facilidad?
- Qui pleure devant les films ? `coeur:2`
  en: Who cries at movies?
  es: ¿Quién llora con las pelis?
- Qui change d’avis toutes les cinq minutes ? `chaos:2 cerveau:-1`
  en: Who changes their mind every five minutes?
  es: ¿Quién cambia de opinión cada cinco minutos?
- Qui est incapable de choisir au resto ? `genance:2 cerveau:-1`
  en: Who can never decide what to order at a restaurant?
  es: ¿Quién es incapaz de decidir qué pedir en un restaurante?
- Qui mange le plus ? `exces:3`
  en: Who eats the most?
  es: ¿Quién come más?
- Qui dort le plus ? `exces:2`
  en: Who sleeps the most?
  es: ¿Quién duerme más?
- Qui stresse pour un rien ? `genance:2 chaos:1`
  en: Who stresses out over nothing?
  es: ¿Quién se estresa por nada?
- Qui annule les plans au dernier moment ? `toxique:1 chaos:1 coeur:-1`
  en: Who bails on plans at the last minute?
  es: ¿Quién cancela los planes a última hora?
- Qui répond aux messages le plus lentement ? `toxique:1 chaos:1`
  en: Who's the slowest at answering texts?
  es: ¿Quién tarda más en contestar los mensajes?
- Qui se plaint d’être fatigué tout le temps ? `toxique:1 exces:1`
  en: Who's always complaining about being tired?
  es: ¿Quién se queja todo el rato de estar cansado?
- Qui a toujours faim ? `exces:2`
  en: Who's always hungry?
  es: ¿Quién tiene siempre hambre?
- Qui boude le plus longtemps ? `toxique:2`
  en: Who sulks the longest?
  es: ¿Quién se pasa más tiempo de morros?
- Qui parle tout seul ? `genance:2 chaos:1`
  en: Who talks to themselves?
  es: ¿Quién habla solo?
- Qui s’excuse tout le temps pour rien ? `genance:2 coeur:1`
  en: Who's always saying sorry for nothing?
  es: ¿Quién pide perdón todo el rato por nada?
- Qui exagère toutes ses histoires ? `toxique:1 chaos:1`
  en: Who exaggerates all their stories?
  es: ¿Quién exagera todas sus historias?
- Qui est le plus maniaque du ménage ? `cerveau:1 chaos:-2`
  en: Who's the biggest clean freak?
  es: ¿Quién es el más maniático de la limpieza?
- Qui a les goûts les plus bizarres en bouffe ? `chaos:2`
  en: Who has the weirdest taste in food?
  es: ¿Quién tiene los gustos más raros para la comida?
- Qui dépense son argent le plus vite ? `exces:3 cerveau:-1`
  en: Who blows through their money the fastest?
  es: ¿Quién se pule la pasta más rápido?
- Qui procrastine le plus ? `cerveau:-1 chaos:1`
  en: Who procrastinates the most?
  es: ¿Quién procrastina más?
- Qui oublie tout ce qu’on lui dit ? `cerveau:-2`
  en: Who forgets everything you tell them?
  es: ¿Quién se olvida de todo lo que le dices?
- Qui fait toujours la même blague ? `genance:2`
  en: Who always makes the same joke?
  es: ¿Quién hace siempre el mismo chiste?
- Qui donne son avis même quand on lui demande rien ? `toxique:2`
  en: Who gives their opinion even when nobody asked?
  es: ¿Quién da su opinión aunque nadie se la pida?
- Qui se vexe le plus vite ? `toxique:1 genance:2`
  en: Who gets offended the fastest?
  es: ¿Quién se pica antes?
- Qui est le plus dur à réveiller ? `exces:2`
  en: Who's the hardest to wake up?
  es: ¿A quién le cuesta más despertarse?
- Qui met des heures à se préparer ? `hot:1`
  en: Who takes forever to get ready?
  es: ¿Quién tarda horas en arreglarse?
- Qui tu appellerais pour te remonter le moral ? `coeur:3`
  en: Who would you call to cheer you up?
  es: ¿A quién llamarías para que te animara?
- Qui tu choisirais pour te réveiller le matin ? `chaos:-2 cerveau:1`
  en: Who would you pick to wake you up in the morning?
  es: ¿A quién elegirías para que te despertara por la mañana?
- Qui a un avis sur tout, même sur ce qu’il ne connaît pas ? `toxique:1 genance:1`
  en: Who has an opinion on everything, even stuff they know nothing about?
  es: ¿Quién opina de todo, hasta de lo que no tiene ni idea?

## 🤓 Geek & Culture
<!-- id: geek -->
<!-- en: Geek & Culture -->
<!-- es: Geek y cultura -->
> Jeux vidéo, séries, ordis et culture G.
> en: Video games, TV shows, computers and trivia.
> es: Videojuegos, series, ordenadores y cultura general.

- Qui pourrait réciter une série entière par cœur ? `genance:1 cerveau:1`
  en: Who could recite an entire TV series by heart?
  es: ¿Quién podría recitar una serie entera de memoria?
- Qui passerait une nuit blanche pour finir un jeu vidéo ? `exces:1 chaos:1` #gaming
  en: Who’d pull an all-nighter to finish a video game?
  es: ¿Quién se pasaría la noche en vela para terminarse un videojuego?
- Qui expliquerait le lore d’un jeu pendant 45 minutes sans qu’on lui demande ? `genance:2 cerveau:1` #gaming
  en: Who’d explain a game’s lore for 45 minutes without being asked?
  es: ¿Quién te explicaría el lore de un juego durante 45 minutos sin que nadie se lo pida?
- Qui aurait le PC gamer le plus cher pour jouer à Minecraft ? `exces:1 genance:1` #gaming
  en: Who’d have the priciest gaming PC just to play Minecraft?
  es: ¿Quién tendría el PC gamer más caro solo para jugar al Minecraft?
- Qui balancerait sa manette après une défaite ? `toxique:1 chaos:2` #gaming
  en: Who’d throw their controller after losing?
  es: ¿Quién tiraría el mando después de perder?
- Qui insulterait des gamins de 12 ans en ligne ? `toxique:2 genance:1` #gaming
  en: Who’d trash-talk 12-year-olds online?
  es: ¿Quién insultaría a críos de 12 años online?
- Qui serait nul à un jeu tout en se disant « pro » ? `genance:2` #gaming
  en: Who’d be terrible at a game while calling themselves a pro?
  es: ¿Quién sería un paquete jugando pero diría que es «pro»?
- Qui ferait la queue le jour de la sortie d’une console ? `exces:2` #gaming
  en: Who’d queue on launch day for a new console?
  es: ¿Quién haría cola el día que sale una consola nueva?
- Qui finirait un jeu à 100 %, trophées compris ? `cerveau:1 exces:1` #gaming
  en: Who’d finish a game 100%, every trophy included?
  es: ¿Quién se pasaría un juego al 100 %, trofeos incluidos?
- Qui se ferait bannir d’un serveur Discord ? `toxique:2 chaos:1`
  en: Who’d get banned from a Discord server?
  es: ¿A quién banearían de un servidor de Discord?
- Qui lancerait un débat Star Wars contre Star Trek à 2h du mat ? `cerveau:1 genance:1`
  en: Who’d start a Star Wars vs Star Trek debate at 2am?
  es: ¿Quién empezaría un debate Star Wars vs Star Trek a las 2 de la mañana?
- Qui a déjà pleuré devant un anime ? `coeur:2 genance:1`
  en: Who’s cried watching an anime?
  es: ¿Quién ha llorado alguna vez viendo un anime?
- Qui monterait son propre PC et en parlerait pendant des semaines ? `cerveau:2 genance:1`
  en: Who’d build their own PC and talk about it for weeks?
  es: ¿Quién se montaría su propio PC y estaría semanas dándote la chapa con ello?
- Qui aurait plus de karma sur Reddit que d’amis ? `genance:2`
  en: Who’d have more Reddit karma than friends?
  es: ¿Quién tendría más karma en Reddit que amigos?
- Qui coderait une appli juste pour trancher un débat du groupe ? `cerveau:3`
  en: Who’d code an app just to settle a group argument?
  es: ¿Quién programaría una app solo para zanjar un debate del grupo?
- Qui irait à une convention en cosplay de la tête aux pieds ? `genance:2 chaos:1`
  en: Who’d go to a convention in full cosplay?
  es: ¿Quién iría a una convención con cosplay de la cabeza a los pies?
- Qui relèverait une erreur scientifique en plein film au cinéma ? `cerveau:2 toxique:1`
  en: Who’d point out a scientific mistake in the middle of a film?
  es: ¿Quién señalaría un error científico en mitad de una peli en el cine?
- Qui ne se remettrait jamais d’un spoiler ? `genance:1 coeur:1`
  en: Who’d never get over being spoiled?
  es: ¿Quién no superaría nunca un spoiler?
- Qui serait le maître du jeu le plus impitoyable dans un jeu de rôle ? `chaos:2 cerveau:1`
  en: Who’d be the most ruthless game master in a tabletop RPG?
  es: ¿Quién sería el máster más despiadado en una partida de rol?
- Qui demanderait à ChatGPT quoi répondre à son crush ? `genance:2`
  en: Who’d ask ChatGPT what to text their crush?
  es: ¿Quién le preguntaría a ChatGPT qué contestarle a su crush?
- Qui aurait 400 onglets ouverts sur son ordi ? `chaos:2`
  en: Who’d have 400 tabs open on their laptop?
  es: ¿Quién tendría 400 pestañas abiertas en el ordenador?
- Qui lirait les conditions d’utilisation en entier ? `cerveau:2 genance:1`
  en: Who’d actually read the terms and conditions?
  es: ¿Quién se leería los términos y condiciones enteros?
- Qui investirait dans la première start-up d’IA bidon venue ? `chaos:1 cerveau:-1`
  en: Who’d invest in the first dodgy AI start-up going?
  es: ¿Quién invertiría en cualquier start-up de IA cutre que le saliera?
- Qui aurait un avis tranché sur chaque langage de programmation ? `cerveau:2 toxique:1`
  en: Who’d have strong opinions on every programming language?
  es: ¿Quién tendría una opinión tajante sobre cada lenguaje de programación?
- Qui tiendrait un tableur de tous les films qu’il a vus ? `cerveau:1 genance:2`
  en: Who’d keep a spreadsheet of every film they’ve seen?
  es: ¿Quién llevaría un Excel con todas las pelis que ha visto?
- Qui pourrait parler d’échecs toute une soirée ? `cerveau:2 genance:1`
  en: Who could talk about chess all night?
  es: ¿Quién podría hablar de ajedrez toda la noche?
- Qui a la meilleure culture ciné du groupe ? `cerveau:2`
  en: Who knows the most about films in the group?
  es: ¿Quién sabe más de cine en el grupo?
- Qui gagnerait à Qui veut gagner des millions ? `cerveau:3`
  en: Who’d win Who Wants to Be a Millionaire?
  es: ¿Quién ganaría el concurso de Quién quiere ser millonario?
- Qui relirait les règles d’un jeu de société dix fois avant de jouer ? `cerveau:1 genance:1`
  en: Who’d reread a board game’s rules ten times before playing?
  es: ¿Quién se releería las reglas de un juego de mesa diez veces antes de jugar?
- Qui tu prendrais dans ton équipe pour un escape game ? `cerveau:2`
  en: Who would you pick for your escape room team?
  es: ¿A quién elegirías para tu equipo en un escape room?
- Qui tu appellerais pour réparer ton ordi ? `cerveau:2 coeur:1`
  en: Who would you call to fix your computer?
  es: ¿A quién llamarías para que te arreglara el ordenador?

## 🌶️ Pimenté · 18+
<!-- id: pimente -->
<!-- en: Spicy -->
<!-- es: Picante -->
> Ça commence à chauffer.
> en: Things are heating up.
> es: La cosa se empieza a calentar.

- Qui aurait le plus gros body count ? `hot:3 exces:1`
  en: Who'd have the highest body count?
  es: ¿Quién tendría el body count más alto?
- Qui embrasserait le mieux ? `hot:3`
  en: Who'd be the best kisser?
  es: ¿Quién besaría mejor?
- Qui serait capable d’envoyer des nudes ce soir ? `hot:2 chaos:2`
  en: Who'd be down to send nudes tonight?
  es: ¿Quién sería capaz de mandar nudes esta noche?
- Qui draguerait le serveur ou la serveuse pour avoir un shot gratuit ? `hot:2 exces:1` #soiree
  en: Who'd flirt with the waiter or waitress to get a free shot?
  es: ¿Quién ligaría con el camarero o la camarera para que le invitaran a un chupito?
- Qui serait le plus partant pour embrasser quelqu’un de ce groupe ? `hot:2 chaos:1` #mixte
  en: Who'd be the most down to kiss someone in this group?
  es: ¿Quién tendría más ganas de liarse con alguien de este grupo?
- Qui conclurait dès le premier date ? `hot:2 chaos:1`
  en: Who'd hook up on the first date?
  es: ¿Quién acabaría en la cama en la primera cita?
- Qui aurait la pire technique de drague ? `genance:3 hot:-2`
  en: Who'd have the worst pickup game?
  es: ¿Quién tendría la peor técnica para ligar?
- Qui enverrait les textos les plus chauds ? `hot:3`
  en: Who'd send the hottest texts?
  es: ¿Quién mandaría los mensajes más calientes?
- Qui serait le plus accro aux applis de rencontre ? `hot:2 exces:2` #celib
  en: Who'd be the most hooked on dating apps?
  es: ¿Quién estaría más enganchado a las apps de ligar?
- Qui pourrait coucher avec quelqu’un sans connaître son prénom ? `hot:2 exces:2 chaos:1`
  en: Who could sleep with someone without even knowing their name?
  es: ¿Quién podría acostarse con alguien sin saber ni cómo se llama?
- Qui se ferait le plus souvent recaler ? `genance:3 hot:-2`
  en: Who'd get turned down the most?
  es: ¿A quién le darían calabazas más a menudo?
- Qui porterait les sous-vêtements les plus sexy ? `hot:3`
  en: Who'd wear the sexiest underwear?
  es: ¿Quién llevaría la ropa interior más sexy?
- Qui rougirait le plus vite quand on parle de cul ? `genance:2 hot:-1`
  en: Who'd blush the fastest when we talk about sex?
  es: ¿A quién se le subirían antes los colores cuando hablamos de sexo?
- Qui aurait le regard le plus charmeur ? `hot:3`
  en: Who'd have the flirtiest eyes?
  es: ¿Quién tendría la mirada más seductora?
- Qui ferait semblant d’aimer un bisou horrible ? `genance:2 coeur:1`
  en: Who'd pretend to like a horrible kiss?
  es: ¿Quién fingiría que le ha gustado un beso horrible?
- Qui pourrait craquer pour un prof ? `hot:1 chaos:1` #etudes
  en: Who could fall for a teacher?
  es: ¿Quién podría pillarse de un profe?
- Qui serait le plus partant pour un strip poker ? `hot:2 chaos:2`
  en: Who'd be the most down for strip poker?
  es: ¿Quién se apuntaría antes a un strip póker?
- Qui aurait le plus de crushs secrets dans ce groupe ? `hot:2 chaos:1` #mixte
  en: Who'd have the most secret crushes in this group?
  es: ¿Quién tendría más crushes secretos en este grupo?
- Qui ferait le meilleur strip-tease ? `hot:3 chaos:1`
  en: Who'd do the best striptease?
  es: ¿Quién haría el mejor striptease?
- Qui serait le plus maladroit au premier bisou ? `genance:3`
  en: Who'd be the most awkward at a first kiss?
  es: ¿Quién sería más torpe en el primer beso?
- Qui embrasserait plus de trois personnes dans la même soirée ? `hot:2 exces:2 chaos:1` #soiree
  en: Who'd make out with more than three people in one night?
  es: ¿Quién se liaría con más de tres personas en la misma noche?
- Qui se mettrait en couple avec quelqu’un rencontré en boîte la veille ? `chaos:2 hot:1 cerveau:-1` #soiree
  en: Who'd get into a relationship with someone they met at the club the night before?
  es: ¿Quién empezaría a salir con alguien que conoció la noche antes en la disco?
- Qui aurait la voix la plus sexy ? `hot:3`
  en: Who'd have the sexiest voice?
  es: ¿Quién tendría la voz más sexy?
- Qui enverrait un message chaud à la mauvaise personne ? `genance:3 chaos:1 hot:1`
  en: Who'd send a dirty text to the wrong person?
  es: ¿Quién mandaría un mensaje subido de tono a la persona equivocada?
- Qui devrait cacher un suçon à ses parents ? `hot:2 genance:1` #parents
  en: Who'd have to hide a hickey from their parents?
  es: ¿Quién tendría que esconderles un chupetón a sus padres?
- Qui draguerait avec des blagues de beauf ? `genance:3 hot:-1`
  en: Who'd flirt using trashy dad jokes?
  es: ¿Quién ligaría con chistes de cuñado?
- Qui roulerait une pelle à quelqu’un pour gagner un pari ? `chaos:2 hot:1`
  en: Who'd make out with someone to win a bet?
  es: ¿Quién se morrearía con alguien para ganar una apuesta?
- Qui ferait les meilleurs massages ? `hot:2 coeur:1`
  en: Who'd give the best massages?
  es: ¿Quién daría los mejores masajes?
- Qui fuirait un date en plein milieu ? `toxique:2 chaos:1`
  en: Who'd ditch a date halfway through?
  es: ¿Quién se piraría a mitad de una cita?
- Qui aurait l’air sage mais cacherait bien son jeu ? `hot:2 chaos:1`
  en: Who'd look all innocent but secretly be a whole other story?
  es: ¿Quién tendría pinta de inocente pero luego sería otra historia?
- Qui tu choisirais comme wingman en soirée ? `hot:2 coeur:1` #soiree
  en: Who would you pick as your wingman on a night out?
  es: ¿A quién elegirías de wingman para salir de fiesta?
- À qui tu demanderais des conseils de drague ? `hot:3`
  en: Who would you ask for flirting tips?
  es: ¿A quién le pedirías consejos para ligar?
- Qui tu laisserais choisir ton date à l’aveugle ? `cerveau:1 coeur:1`
  en: Who would you let pick your blind date?
  es: ¿A quién dejarías elegirte una cita a ciegas?
- Qui tu embrasserais si tu devais choisir quelqu’un du groupe ? `hot:3` #mixte
  en: Who would you kiss if you had to pick someone in the group?
  es: ¿A quién besarías si tuvieras que elegir a alguien del grupo?

## 🔥 Très hot · 18+
<!-- id: tres-hot -->
<!-- en: Really Hot -->
<!-- es: Muy hot -->
> Là on parle de cul.
> en: Now we're talking sex.
> es: Aquí ya hablamos de sexo.

- Qui serait le plus bruyant au lit ? `hot:2 genance:2`
  en: Who'd be the loudest in bed?
  es: ¿Quién haría más ruido en la cama?
- Qui aurait le kink le plus chelou ? `hot:2 chaos:2`
  en: Who'd have the weirdest kink?
  es: ¿Quién tendría el kink más raro?
- Qui le ferait en pleine nature ou sur une plage ? `hot:2 chaos:3`
  en: Who'd do it out in the wild or on a beach?
  es: ¿Quién lo haría en plena naturaleza o en una playa?
- Qui aurait la plus grosse collection de sextoys ? `hot:3 exces:2`
  en: Who'd have the biggest sex toy collection?
  es: ¿Quién tendría la colección de juguetes sexuales más grande?
- Qui aurait le plus d’expérience au lit ? `hot:3 exces:1`
  en: Who'd have the most experience in bed?
  es: ¿Quién tendría más experiencia en la cama?
- Qui serait le plus doué avec sa langue ? `hot:3`
  en: Who'd be the best with their tongue?
  es: ¿Quién sería más hábil con la lengua?
- Qui le ferait à l’arrière d’une voiture ? `hot:2 chaos:1`
  en: Who'd do it in the back of a car?
  es: ¿Quién lo haría en el asiento de atrás de un coche?
- Qui serait partant pour essayer le bondage ? `hot:2 chaos:2`
  en: Who'd be down to try bondage?
  es: ¿Quién se apuntaría a probar el bondage?
- Qui serait le plus dominant au lit ? `hot:3 toxique:1`
  en: Who'd be the most dominant in bed?
  es: ¿Quién sería más dominante en la cama?
- Qui serait secrètement le plus soumis ? `hot:2`
  en: Who'd secretly be the most submissive?
  es: ¿Quién sería en secreto la persona más sumisa?
- Qui aurait la plus grosse libido du groupe ? `hot:3 exces:2`
  en: Who'd have the highest sex drive in the group?
  es: ¿Quién tendría la libido más alta del grupo?
- Qui filmerait ses ébats ? `hot:2 chaos:2`
  en: Who'd film themselves having sex?
  es: ¿Quién se grabaría haciéndolo?
- Qui se ferait surprendre en plein acte ? `genance:3 hot:1 chaos:1`
  en: Who'd get caught in the act?
  es: ¿A quién pillarían en pleno acto?
- Qui finirait en deux minutes chrono ? `genance:3 hot:-2`
  en: Who'd be done in two minutes flat?
  es: ¿Quién acabaría en dos minutos pelados?
- Qui pourrait le faire cinq fois dans la même nuit ? `hot:3 exces:2`
  en: Who could do it five times in one night?
  es: ¿Quién podría hacerlo cinco veces en la misma noche?
- Qui connaîtrait le plus de positions du Kamasutra ? `hot:3`
  en: Who'd know the most Kama Sutra positions?
  es: ¿Quién se sabría más posturas del Kamasutra?
- Qui aurait les dirty talks les plus ratés ? `genance:3 hot:-1`
  en: Who'd have the worst dirty talk?
  es: ¿Quién tendría el dirty talk más penoso?
- Qui le ferait dans le lit de ses parents ? `chaos:2 toxique:1 hot:1`
  en: Who'd do it in their parents' bed?
  es: ¿Quién lo haría en la cama de sus padres?
- Qui aimerait le plus se prendre une fessée ? `hot:2 chaos:1`
  en: Who'd like getting spanked the most?
  es: ¿A quién le gustaría más que le dieran unos azotes?
- Qui vivrait le pire accident de capote ? `genance:3 hot:1`
  en: Who'd have the worst condom accident?
  es: ¿Quién tendría el peor accidente con el condón?
- Qui oublierait le prénom de quelqu’un en pleine action ? `genance:3 hot:1 toxique:1`
  en: Who'd forget someone's name right in the middle of it?
  es: ¿Quién se olvidaría del nombre de alguien en plena acción?
- Qui ferait toujours la même position par flemme ? `genance:2 hot:-1`
  en: Who'd always do the same position cause they're lazy?
  es: ¿Quién haría siempre la misma postura por pereza?
- Qui serait partant pour un club libertin ? `hot:2 chaos:2 exces:1`
  en: Who'd be down to go to a swingers club?
  es: ¿Quién se apuntaría a ir a un club swinger?
- Qui aurait un plan cul avec son voisin ou sa voisine ? `hot:2 chaos:1`
  en: Who'd have their neighbor as a fuck buddy?
  es: ¿Quién tendría de follamigo al vecino o a la vecina?
- Qui tenterait un truc vu dans un porno et se raterait complètement ? `genance:3 hot:1`
  en: Who'd try something they saw in a porno and totally fail?
  es: ¿Quién intentaría algo que ha visto en un porno y la cagaría del todo?
- Qui le ferait dans les toilettes d’un avion ? `hot:2 chaos:2 exces:1`
  en: Who'd do it in an airplane bathroom?
  es: ¿Quién lo haría en el baño de un avión?
- Qui se prendrait une crampe en plein milieu ? `genance:3`
  en: Who'd get a cramp right in the middle of it?
  es: ¿A quién le daría un calambre en plena faena?
- Qui serait le roi ou la reine des préliminaires ? `hot:3 coeur:1`
  en: Who'd be the king or queen of foreplay?
  es: ¿Quién sería el rey o la reina de los preliminares?
- Qui regarderait le plus de porno ? `exces:3 hot:1`
  en: Who'd watch the most porn?
  es: ¿Quién vería más porno?
- Qui ferait du sexting en pleine réunion ? `hot:2 chaos:2` #travail
  en: Who'd be sexting in the middle of a meeting?
  es: ¿Quién haría sexting en mitad de una reunión?
- À qui tu demanderais des conseils au lit ? `hot:3`
  en: Who would you ask for sex tips?
  es: ¿A quién le pedirías consejos para la cama?
- Qui tu choisirais pour une nuit sans lendemain ? `hot:3`
  en: Who would you pick for a one-night stand?
  es: ¿A quién elegirías para un rollo de una noche?
- Avec qui tu irais acheter des sextoys ? `hot:2 chaos:1`
  en: Who would you go sex toy shopping with?
  es: ¿Con quién irías a comprar juguetes sexuales?
- À qui tu ferais confiance pour garder une sextape secrète ? `coeur:3`
  en: Who would you trust to keep a sex tape secret?
  es: ¿A quién le confiarías guardar en secreto una sextape?

## 😈 Interdit · 18+
<!-- id: interdit -->
<!-- en: Forbidden -->
<!-- es: Prohibido -->
> Tromperies et autres secrets inavouables.
> en: Cheating and other dirty little secrets.
> es: Cuernos y otros secretos inconfesables.

- Qui serait le plus capable de tromper ? `toxique:3 hot:1`
  en: Who'd be the most likely to cheat?
  es: ¿Quién sería más capaz de poner los cuernos?
- Qui ouvrirait un OnlyFans demain si c’était rentable ? `hot:3 exces:1`
  en: Who'd start an OnlyFans tomorrow if it paid off?
  es: ¿Quién se abriría un OnlyFans mañana si saliera rentable?
- Qui serait le plus partant pour un plan à trois ? `hot:3 chaos:2`
  en: Who'd be the most down for a threesome?
  es: ¿Quién se apuntaría antes a un trío?
- Qui coucherait avec l’ex d’un pote sans culpabiliser ? `toxique:3 hot:1`
  en: Who'd sleep with a friend's ex without feeling guilty?
  es: ¿Quién se acostaría con el ex de un colega sin sentirse culpable?
- Qui finirait avec un sugar daddy ou une sugar mommy ? `hot:2 toxique:2`
  en: Who'd end up with a sugar daddy or a sugar mommy?
  es: ¿Quién acabaría con un sugar daddy o una sugar mommy?
- Qui coucherait avec son boss pour une promotion ? `toxique:3 hot:1` #travail
  en: Who'd sleep with their boss for a promotion?
  es: ¿Quién se acostaría con su jefe para que le ascendieran?
- Qui accepterait d’être le plan caché de quelqu’un en couple ? `toxique:3 hot:2`
  en: Who'd be ok being the secret side piece of someone who's taken?
  es: ¿Quién aceptaría ser el lío secreto de alguien con pareja?
- Qui draguerait le mec ou la meuf d’un pote ? `toxique:3 hot:1`
  en: Who'd hit on a friend's bf or gf?
  es: ¿Quién intentaría ligarse al chico o la chica de un colega?
- Qui arriverait à gérer deux relations en même temps ? `toxique:3 chaos:1`
  en: Who could juggle two relationships at the same time?
  es: ¿Quién sería capaz de llevar dos relaciones a la vez?
- Qui fouillerait le téléphone de son mec ou de sa meuf ? `toxique:3`
  en: Who'd go through their bf's or gf's phone?
  es: ¿Quién le cotillearía el móvil a su chico o a su chica?
- Qui aurait une aventure avec un collègue marié ? `toxique:2 hot:2 chaos:1` #travail
  en: Who'd have an affair with a married coworker?
  es: ¿Quién tendría una aventura con un compañero de curro casado?
- Qui ferait « une dernière fois » avec son ex… plusieurs fois ? `hot:2 genance:1 chaos:1`
  en: Who'd do it "one last time" with their ex... several times?
  es: ¿Quién lo haría «una última vez» con su ex… varias veces?
- Qui retournerait avec son ex même après s’être fait tromper ? `genance:2 cerveau:-2`
  en: Who'd get back with their ex even after getting cheated on?
  es: ¿Quién volvería con su ex incluso después de que le pusiera los cuernos?
- Qui coucherait avec quelqu’un juste pour rendre son ex jaloux ? `toxique:3 hot:1`
  en: Who'd sleep with someone just to make their ex jealous?
  es: ¿Quién se acostaría con alguien solo para darle celos a su ex?
- Qui coucherait avec le frère ou la sœur d’un pote ? `hot:2 toxique:2 chaos:1`
  en: Who'd sleep with a friend's brother or sister?
  es: ¿Quién se acostaría con el hermano o la hermana de un colega?
- Qui coucherait avec quelqu’un du groupe si personne ne le savait ? `hot:2 toxique:1 chaos:1` #mixte
  en: Who'd sleep with someone in the group if nobody ever found out?
  es: ¿Quién se acostaría con alguien del grupo si nadie se fuera a enterar?
- Qui coucherait avec un inconnu pour un million ? `hot:2 toxique:1`
  en: Who'd sleep with a stranger for a million?
  es: ¿Quién se acostaría con un desconocido por un millón?
- Qui mentirait sur son body count ? `toxique:2`
  en: Who'd lie about their body count?
  es: ¿Quién mentiría sobre su body count?
- Qui serait capable de briser un couple par pur ennui ? `toxique:3 chaos:2`
  en: Who'd be capable of breaking up a couple out of pure boredom?
  es: ¿Quién sería capaz de cargarse una pareja por puro aburrimiento?
- Qui garderait un plan cul « de secours » même en couple ? `toxique:3 hot:2`
  en: Who'd keep a "backup" fuck buddy even when they're in a relationship?
  es: ¿Quién tendría un follamigo «de reserva» aunque tenga pareja?
- Qui aurait honte de son coup d’un soir le lendemain ? `genance:3 hot:1 exces:1`
  en: Who'd be ashamed of their one-night stand the next morning?
  es: ¿Quién se avergonzaría al día siguiente de su rollo de una noche?
- Qui enverrait des nudes à quelqu’un en couple ? `toxique:2 hot:2`
  en: Who'd send nudes to someone who's taken?
  es: ¿Quién le mandaría nudes a alguien con pareja?
- Qui pourrait faire carrière dans le X ? `hot:3 chaos:2`
  en: Who could make a career in porn?
  es: ¿Quién podría hacer carrera en el porno?
- Qui péterait un câble en voyant son ex avec quelqu’un du groupe ? `toxique:3`
  en: Who'd lose their shit seeing their ex with someone from the group?
  es: ¿A quién se le iría la olla al ver a su ex con alguien del grupo?
- Qui coucherait avec un pote et ferait comme si de rien n’était ? `hot:2 toxique:1`
  en: Who'd sleep with a friend and act like nothing happened?
  es: ¿Quién se acostaría con un colega y haría como si nada?
- Qui accepterait un couple libre sans hésiter une seconde ? `hot:2 chaos:2`
  en: Who'd say yes to an open relationship without thinking twice?
  es: ¿Quién aceptaría una relación abierta sin pensárselo ni un segundo?
- Qui souhaiterait secrètement qu’un couple d’amis se sépare ? `toxique:2 coeur:-2`
  en: Who'd secretly want a couple in our friend group to break up?
  es: ¿Quién desearía en secreto que una pareja de amigos lo dejara?
- Qui choperait à un mariage alors qu’il est venu accompagné ? `toxique:3 hot:1 exces:1`
  en: Who'd hook up with someone at a wedding even though they came with a date?
  es: ¿Quién se liaría con alguien en una boda aunque haya ido con pareja?
- Qui se ferait inviter au resto par des dates qu’il compte jamais revoir ? `toxique:3`
  en: Who'd let dates pay for dinner when they never plan on seeing them again?
  es: ¿Quién se dejaría invitar a cenar por citas a las que no piensa volver a ver?
- Qui tromperait avec une célébrité en jurant que « ça compte pas » ? `toxique:2 hot:2`
  en: Who'd cheat with a celebrity and swear "it doesn't count"?
  es: ¿Quién pondría los cuernos con un famoso jurando que «eso no cuenta»?
- Qui tu choisirais pour un plan à trois ? `hot:3 chaos:1`
  en: Who would you pick for a threesome?
  es: ¿A quién elegirías para un trío?
- À qui tu avouerais une tromperie en premier ? `coeur:2`
  en: Who would you confess cheating to first?
  es: ¿A quién le confesarías primero que has puesto los cuernos?
- Qui tu laisserais jamais seul avec ton mec ou ta meuf ? `toxique:3 hot:2` #couple
  en: Who would you never leave alone with your bf or gf?
  es: ¿A quién no dejarías nunca a solas con tu chico o tu chica?
- À qui tu demanderais de mentir pour toi à ton mec ou ta meuf ? `toxique:1 coeur:1 cerveau:1` #couple
  en: Who would you ask to lie to your bf or gf for you?
  es: ¿A quién le pedirías que mintiera por ti a tu chico o tu chica?
