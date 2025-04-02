// Fonction pour générer une histoire en français avec Transformers.js
async function generateStory(keywords) {
  try {
    // Afficher un message de chargement
    document.getElementById('scenario-content').innerHTML = `
      <div style="padding: 20px; background-color: #f0f0f0; border-radius: 8px; margin-top: 20px;">
        <h3>Génération du scénario en cours...</h3>
        <p>Veuillez patienter pendant que l'IA génère votre histoire à partir des mots-clés: ${keywords}</p>
        <div class="loading-spinner"></div>
      </div>
    `;

    // Importer la bibliothèque Transformers.js
    const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.0');
    
    // Créer un facteur d'aléatoire basé sur l'horodatage et un nombre aléatoire
    const randomSeed = Date.now() + Math.floor(Math.random() * 10000);
    
    // Fonction pour générer un nombre aléatoire basé sur le seed
    const getRandomNumber = (min, max) => {
      const randomValue = Math.sin(randomSeed * (min + max)) * 10000;
      return Math.floor((randomValue - Math.floor(randomValue)) * (max - min + 1)) + min;
    };

    // Générer un titre aléatoire basé sur les mots-clés
    const keywordsArray = keywords.split(',').map(k => k.trim());
    const mainKeyword = keywordsArray[getRandomNumber(0, keywordsArray.length - 1)];
    
    // Liste de préfixes et suffixes pour le titre
    const prefixes = ['Le mystère de', 'L\'aventure de', 'La quête de', 'Le secret de', 'La légende de'];
    const suffixes = ['perdu', 'éternel', 'oublié', 'interdit', 'mystérieux', 'fantastique'];
    
    const prefix = prefixes[getRandomNumber(0, prefixes.length - 1)];
    const suffix = suffixes[getRandomNumber(0, suffixes.length - 1)];
    
    const title = `${prefix} ${mainKeyword} ${suffix}`;

    // Initialiser le modèle de génération de texte
    const generator = await pipeline('text-generation', 'Felladrin/onnx-bloomz-560m-sft-chat');
    
    // Créer un prompt pour générer une histoire en français
    const prompt = `Écris une histoire captivante de bande dessinée sur ${keywords} avec le titre "${title}". L'histoire doit avoir une introduction, un développement et une conclusion. Elle doit être détaillée et avoir au moins 500 mots.`;
    
    // Générer l'histoire
    const result = await generator(prompt, {
      max_new_tokens: 1000,
      temperature: 0.7,
      top_p: 0.95,
      repetition_penalty: 1.2
    });
    
    // Extraire le texte généré
    const generatedText = result[0].generated_text.replace(prompt, '').trim();
    
    // Diviser l'histoire en chapitres
    const numChapters = getRandomNumber(3, 5);
    const textLength = generatedText.length;
    const chapterSize = Math.floor(textLength / numChapters);
    
    let chapters = [];
    for (let i = 0; i < numChapters; i++) {
      const start = i * chapterSize;
      const end = (i === numChapters - 1) ? textLength : (i + 1) * chapterSize;
      const chapterText = generatedText.substring(start, end);
      
      const chapterTitle = i === 0 ? 'Introduction' : i === numChapters - 1 ? 'Conclusion' : `Chapitre ${i}`;
      chapters.push({ title: chapterTitle, text: chapterText });
    }
    
    // Générer le contenu du scénario
    let scenarioHTML = `
      <div style="padding: 20px; background-color: #f0f0f0; border-radius: 8px; margin-top: 20px;">
        <h3>Scénario généré à partir des mots-clés: ${keywords}</h3>
        <h4 style="margin-top: 15px; color: #2196F3;">Titre: ${title}</h4>
        
        <div class="scenario-section">
          <h5>Introduction</h5>
          <p>${generateScenarioIntroduction(keywordsArray, title, getRandomNumber)}</p>
        </div>
    `;
    
    // Ajouter les chapitres
    for (let i = 0; i < chapters.length; i++) {
      const chapter = chapters[i];
      scenarioHTML += `
        <div class="scenario-chapter">
          <h4>${chapter.title}</h4>
          <p>${chapter.text}</p>
          
          <div class="scenario-section">
            <h5>Séquencier</h5>
            <p>${generateSequencer(i, numChapters, keywordsArray, getRandomNumber)}</p>
          </div>
          
          <div class="scenario-section">
            <h5>Découpage</h5>
            <p>${generatePageBreakdown(i, numChapters, keywordsArray, getRandomNumber)}</p>
          </div>
        </div>
      `;
    }
    
    scenarioHTML += `
        <div class="scenario-section">
          <h5>Conclusion et thèmes</h5>
          <p>${generateConclusion(keywordsArray, title, getRandomNumber)}</p>
        </div>
        
        <button class="btn" id="view-storyboard">Voir le storyboard</button>
      </div>
    `;
    
    // Afficher le scénario généré
    document.getElementById('scenario-content').innerHTML = scenarioHTML;
    
    // Générer le storyboard
    generateStoryboard(title, keywordsArray, getRandomNumber);
    
    // Générer les prompts en anglais
    generatePrompts(title, keywordsArray, getRandomNumber);
    
    // Ajouter des écouteurs d'événements pour les nouveaux boutons
    document.getElementById('view-storyboard').addEventListener('click', function() {
      document.querySelector('[data-tab="storyboard"]').click();
    });
    
    document.getElementById('generate-prompts').addEventListener('click', function() {
      document.querySelector('[data-tab="prompts"]').click();
    });
    
  } catch (error) {
    console.error('Erreur lors de la génération de l\'histoire:', error);
    
    // Afficher un message d'erreur
    document.getElementById('scenario-content').innerHTML = `
      <div style="padding: 20px; background-color: #ffebee; border-radius: 8px; margin-top: 20px;">
        <h3>Erreur lors de la génération du scénario</h3>
        <p>Nous n'avons pas pu générer votre histoire. Veuillez réessayer avec d'autres mots-clés.</p>
        <p>Erreur technique: ${error.message}</p>
      </div>
    `;
  }
}

// Fonction pour générer le storyboard
function generateStoryboard(title, keywordsArray, getRandomNumber) {
  // Générer quelques pages de storyboard pour exemple
  let storyboardHTML = `
    <div style="padding: 20px; background-color: #f0f0f0; border-radius: 8px; margin-top: 20px;">
      <h3>Storyboard pour "${title}"</h3>
      <p>Mise en page proposée pour chaque chapitre de votre BD.</p>
  `;
  
  // Générer 5 pages de storyboard
  for (let i = 1; i <= 5; i++) {
    const pageNum = i;
    const numPanels = getRandomNumber(3, 6);
    
    storyboardHTML += `
      <div class="storyboard-page">
        <h4>Page ${pageNum}</h4>
        <p><strong>Nombre de cases:</strong> ${numPanels}</p>
        <p><strong>Description:</strong> ${getDetailedPageDescription(pageNum, numPanels, keywordsArray, getRandomNumber)}</p>
        <p><strong>Composition:</strong> ${getPageComposition(pageNum, numPanels, keywordsArray, getRandomNumber)}</p>
      </div>
    `;
  }
  
  storyboardHTML += `
      <button class="btn" id="generate-prompts">Générer les prompts</button>
    </div>
  `;
  
  document.getElementById('storyboard-content').innerHTML = storyboardHTML;
}

// Fonction pour générer les prompts en anglais
function generatePrompts(title, keywordsArray, getRandomNumber) {
  // Traduire les mots-clés en anglais
  const englishKeywords = keywordsArray.map(keyword => {
    const translations = {
      'aventure': 'adventure',
      'mystère': 'mystery',
      'amour': 'love',
      'science-fiction': 'science fiction',
      'fantasy': 'fantasy',
      'magie': 'magic',
      'espace': 'space',
      'robots': 'robots',
      'dragons': 'dragons',
      'superhéros': 'superheroes',
      'pirates': 'pirates',
      'ninja': 'ninja',
      'zombies': 'zombies',
      'vampires': 'vampires',
      'loup-garou': 'werewolf',
      'sorcier': 'wizard',
      'chevalier': 'knight',
      'princesse': 'princess',
      'roi': 'king',
      'reine': 'queen',
      'guerre': 'war',
      'paix': 'peace',
      'amitié': 'friendship',
      'trahison': 'betrayal',
      'vengeance': 'revenge',
      'pardon': 'forgiveness',
      'quête': 'quest',
      'voyage': 'journey',
      'découverte': 'discovery',
      'trésor': 'treasure',
      'forêt': 'forest',
      'montagne': 'mountain',
      'océan': 'ocean',
      'désert': 'desert',
      'ville': 'city',
      'village': 'village',
      'château': 'castle',
      'vaisseau spatial': 'spaceship',
      'futur': 'future',
      'passé': 'past',
      'présent': 'present',
      'apocalypse': 'apocalypse',
      'utopie': 'utopia',
      'dystopie': 'dystopia'
    };
    
    return translations[keyword.toLowerCase()] || keyword;
  });
  
  // Traduire le titre en anglais
  let englishTitle = title;
  const titleParts = title.split(' ');
  const translatedParts = titleParts.map(part => {
    const translations = {
      'Le': 'The',
      'La': 'The',
      'Les': 'The',
      'mystère': 'mystery',
      'aventure': 'adventure',
      'quête': 'quest',
      'secret': 'secret',
      'légende': 'legend',
      'de': 'of',
      'du': 'of the',
      'des': 'of the',
      'perdu': 'lost',
      'éternel': 'eternal',
      'oublié': 'forgotten',
      'interdit': 'forbidden',
      'mystérieux': 'mysterious',
      'fantastique': 'fantastic'
    };
    
    return translations[part.toLowerCase()] || part;
  });
  englishTitle = translatedParts.join(' ');
  
  // Générer les prompts
  let promptsHTML = `
    <div style="padding: 20px; background-color: #f0f0f0; border-radius: 8px; margin-top: 20px;">
      <h3>Prompts pour Midjourney: "${englishTitle}"</h3>
      <p>Prompts optimisés pour générer des images correspondant à votre scénario.</p>
  `;
  
  // Générer 5 exemples de prompts
  for (let i = 1; i <= 5; i++) {
    const panelNum = i;
    
    promptsHTML += `
      <div class="prompt-item">
        <h4>Case ${panelNum}</h4>
        <p><strong>Description de la scène (français):</strong> ${getSceneDescription(panelNum, keywordsArray, getRandomNumber)}</p>
        <pre>${generateDetailedMidjourneyPrompt(panelNum, englishKeywords, getRandomNumber)}</pre>
      </div>
    `;
  }
  
  promptsHTML += `
      <button class="btn" onclick="alert('Prompts exportés avec succès !');">Exporter les prompts</button>
    </div>
  `;
  
  document.getElementById('prompts-content').innerHTML = promptsHTML;
}

// Fonction pour générer une introduction de scénario
function generateScenarioIntroduction(keywords, title, randomFunc) {
  const settings = [
    'un monde futuriste où la technologie et la nature coexistent',
    'une époque médiévale fantastique peuplée de créatures mystérieuses',
    'un univers post-apocalyptique où l\'humanité tente de se reconstruire',
    'une société utopique cachant de sombres secrets',
    'une réalité alternative où l\'histoire a pris un tournant différent'
  ];
  
  const conflicts = [
    'la lutte pour la survie face à une menace imminente',
    'la quête d\'un artefact légendaire aux pouvoirs inimaginables',
    'le combat contre un antagoniste puissant et manipulateur',
    'la résolution d\'un mystère ancien qui bouleverse l\'ordre établi',
    'la découverte d\'une vérité cachée qui remet en question toutes les croyances'
  ];
  
  const setting = settings[randomFunc(0, settings.length - 1)];
  const conflict = conflicts[randomFunc(0, conflicts.length - 1)];
  const keyword1 = keywords[randomFunc(0, keywords.length - 1)];
  const keyword2 = keywords[randomFunc(0, keywords.length - 1)];
  
  return `Notre histoire se déroule dans ${setting}. Le récit de "${title}" explore ${conflict}, dans un univers où ${keyword1} et ${keyword2} jouent un rôle central. Cette bande dessinée de 48 pages propose une narration visuelle captivante qui emmènera le lecteur dans un voyage émotionnel à travers des paysages imaginaires et des situations intenses. L'intrigue se développe progressivement, révélant couche après couche la complexité des personnages et les enjeux de leur monde. Chaque page est conçue pour maintenir l'intérêt du lecteur tout en construisant un univers cohérent et immersif.`;
}

// Fonction pour générer un séquencier
function generateSequencer(chapterNum, totalChapters, keywords, randomFunc) {
  const sequences = [
    'une poursuite haletante à travers des paysages spectaculaires',
    'une confrontation verbale tendue révélant des vérités cachées',
    'une découverte majeure qui remet en question les croyances établies',
    'un moment de calme et d\'introspection avant la tempête',
    'une bataille épique aux conséquences irréversibles'
  ];
  
  const transitions = [
    'un flashback révélateur qui éclaire les motivations d\'un personnage',
    'un changement de point de vue qui offre une nouvelle perspective',
    'une ellipse temporelle qui fait avancer l\'intrigue',
    'un contraste visuel saisissant entre deux environnements',
    'un parallélisme narratif entre deux situations simultanées'
  ];
  
  let sequencerText = '';
  const numSequences = randomFunc(3, 5);
  
  for (let i = 1; i <= numSequences; i++) {
    const sequence = sequences[randomFunc(0, sequences.length - 1)];
    const transition = transitions[randomFunc(0, transitions.length - 1)];
    const keyword = keywords[randomFunc(0, keywords.length - 1)];
    
    sequencerText += `Séquence ${i}: ${sequence} mettant en valeur le thème de ${keyword}. `;
    
    if (i < numSequences) {
      sequencerText += `Transition: ${transition}. `;
    }
  }
  
  return sequencerText;
}

// Fonction pour générer un découpage de page
function generatePageBreakdown(chapterNum, totalChapters, keywords, randomFunc) {
  const layouts = [
    'une grille classique de 6 cases régulières',
    'une composition dynamique avec une case dominante et plusieurs cases secondaires',
    'une double page spectaculaire avec une illustration panoramique',
    'une mise en page expérimentale jouant avec la forme et la taille des cases',
    'une séquence de cases en cascade créant un effet de mouvement'
  ];
  
  const visualElements = [
    'des jeux d\'ombre et de lumière créant une atmosphère mystérieuse',
    'des couleurs vives contrastant avec des zones monochromes',
    'des perspectives exagérées accentuant l\'impact émotionnel',
    'des motifs récurrents symbolisant les thèmes centraux',
    'des transitions fluides entre les cases pour une lecture immersive'
  ];
  
  const layout = layouts[randomFunc(0, layouts.length - 1)];
  const visualElement = visualElements[randomFunc(0, visualElements.length - 1)];
  const keyword = keywords[randomFunc(0, keywords.length - 1)];
  
  return `Ce chapitre utilise principalement ${layout} pour raconter l'histoire. Les pages intègrent ${visualElement}, renforçant l'impact visuel des moments clés. Les scènes liées à ${keyword} bénéficient d'un traitement visuel particulier, utilisant des compositions qui soulignent leur importance narrative. Le rythme visuel alterne entre des séquences d'action rapides avec de nombreuses cases et des moments plus contemplatifs utilisant des cases plus grandes. Les transitions entre les scènes sont soigneusement planifiées pour maintenir la fluidité narrative tout en créant des moments de surprise et de révélation.`;
}

// Fonction pour générer une conclusion
function generateConclusion(keywords, title, randomFunc) {
  const themes = [
    'la rédemption à travers le sacrifice',
    'la transformation personnelle face à l\'adversité',
    'l\'acceptation de vérités difficiles mais libératrices',
    'la force de la communauté et de la solidarité',
    'l\'équilibre retrouvé entre des forces opposées'
  ];
  
  const impacts = [
    'une résolution émotionnellement satisfaisante tout en laissant certaines questions ouvertes',
    'un dénouement qui transforme la perception initiale de l\'histoire',
    'une conclusion qui résonne avec les thèmes contemporains de notre société',
    'un final qui invite à la réflexion sur les choix et leurs conséquences',
    'une fin qui boucle élégamment les arcs narratifs tout en ouvrant de nouvelles possibilités'
  ];
  
  const theme = themes[randomFunc(0, themes.length - 1)];
  const impact = impacts[randomFunc(0, impacts.length - 1)];
  const keyword1 = keywords[randomFunc(0, keywords.length - 1)];
  const keyword2 = keywords[randomFunc(0, keywords.length - 1)];
  
  return `"${title}" explore en profondeur ${theme}, offrant ${impact}. Les thèmes de ${keyword1} et ${keyword2} sont résolus de manière cohérente avec le développement des personnages et l'évolution de l'intrigue. Cette bande dessinée ne se contente pas de divertir, elle invite le lecteur à réfléchir sur des questions universelles à travers le prisme d'un univers unique et captivant. La narration visuelle et textuelle se complètent parfaitement pour créer une expérience immersive qui résonne bien après la dernière page. Les personnages terminent leur voyage transformés, reflétant les thèmes centraux de l'histoire et offrant au lecteur des perspectives nouvelles sur des questions fondamentales.`;
}

// Fonction pour générer une description détaillée de page
function getDetailedPageDescription(pageNum, numPanels, keywords, randomFunc) {
  const layouts = [
    'disposition classique avec une grille régulière',
    'cases asymétriques créant un rythme visuel dynamique',
    'grande case centrale entourée de cases plus petites',
    'cases superposées suggérant la simultanéité des actions',
    'mise en page expérimentale brisant les conventions'
  ];
  
  const moods = [
    'atmosphère tendue soulignée par des ombres prononcées',
    'ambiance mystérieuse avec un éclairage tamisé et des couleurs froides',
    'scène d\'action vibrante aux couleurs éclatantes',
    'moment émotionnel intime avec des tons pastel et doux',
    'séquence onirique aux couleurs surréalistes et aux formes fluides'
  ];
  
  const layout = layouts[randomFunc(0, layouts.length - 1)];
  const mood = moods[randomFunc(0, moods.length - 1)];
  const keyword = keywords[randomFunc(0, keywords.length - 1)];
  
  return `Page avec ${numPanels} cases en ${layout}. ${mood} mettant en valeur le thème "${keyword}". Cette page développe un moment clé de l'intrigue, utilisant des angles de vue variés pour maximiser l'impact émotionnel. La progression des cases guide naturellement l'œil du lecteur à travers la séquence narrative, créant un rythme qui soutient efficacement le contenu dramatique. Les expressions faciales des personnages sont particulièrement travaillées pour communiquer leurs émotions sans recourir excessivement aux dialogues.`;
}

// Fonction pour générer une composition de page
function getPageComposition(pageNum, numPanels, keywords, randomFunc) {
  const compositions = [
    'une composition en diagonale créant un sentiment de dynamisme',
    'un arrangement symétrique reflétant l\'équilibre ou le conflit',
    'une structure en spirale guidant l\'œil vers le centre de la page',
    'un contraste entre zones denses et espaces vides pour rythmer la lecture',
    'une composition en couches superposant plusieurs niveaux de narration'
  ];
  
  const techniques = [
    'des variations dans l\'épaisseur des traits pour hiérarchiser l\'information',
    'un jeu sur la profondeur de champ mettant en valeur certains éléments',
    'des motifs récurrents créant une cohérence visuelle',
    'des transitions fluides entre les cases pour une lecture immersive',
    'des ruptures intentionnelles dans le style graphique pour marquer des changements narratifs'
  ];
  
  const composition = compositions[randomFunc(0, compositions.length - 1)];
  const technique = techniques[randomFunc(0, techniques.length - 1)];
  
  return `Cette page utilise ${composition}, combinée avec ${technique}. L'équilibre entre texte et image est soigneusement calibré pour maintenir la fluidité narrative tout en donnant suffisamment d'espace aux éléments visuels. Les cases sont conçues pour créer un rythme qui correspond au contenu émotionnel de la scène, accélérant dans les moments d'action et ralentissant pour les moments de contemplation ou de révélation.`;
}

// Fonction pour générer une description de scène
function getSceneDescription(panelNum, keywords, randomFunc) {
  const scenes = [
    'un moment de confrontation intense entre les protagonistes',
    'une découverte majeure qui change le cours de l\'histoire',
    'un instant de calme contemplatif révélant la beauté du monde',
    'une scène d\'action spectaculaire aux enjeux élevés',
    'un échange émotionnel intime entre personnages'
  ];
  
  const visualElements = [
    'un éclairage dramatique créant des ombres expressives',
    'une palette de couleurs symbolique reflétant l\'état émotionnel des personnages',
    'des détails d\'arrière-plan enrichissant l\'univers',
    'des expressions faciales minutieusement travaillées',
    'une composition guidant l\'œil vers l\'élément narratif central'
  ];
  
  const scene = scenes[randomFunc(0, scenes.length - 1)];
  const visualElement = visualElements[randomFunc(0, visualElements.length - 1)];
  const keyword = keywords[randomFunc(0, keywords.length - 1)];
  
  return `Cette case représente ${scene}, avec ${visualElement}. Le thème de ${keyword} est subtilement intégré dans la composition. L'angle de vue est choisi pour maximiser l'impact émotionnel et narratif de ce moment clé. Les expressions des personnages et leur langage corporel communiquent clairement leurs intentions et leurs émotions, complétant les dialogues sans les répéter.`;
}

// Fonction pour générer un prompt Midjourney détaillé en anglais
function generateDetailedMidjourneyPrompt(panelNum, englishKeywords, randomFunc) {
  const styles = [
    'detailed manga style with fine and precise lines',
    'vibrant American comics style with high contrast colors',
    'European clear line style with flat and elegant colors',
    'realistic style with rich textures and volumetric rendering',
    'watercolor style with diffuse colors and soft contours'
  ];
  
  const shots = [
    'wide shot showing the complete environment and characters',
    'close-up on the face capturing the intense emotion of the moment',
    'medium shot framing the characters from waist to shoulders',
    'aerial view offering a unique perspective on the scene',
    'dramatic low angle shot accentuating the power of the subject'
  ];
  
  const lightings = [
    'dramatic lighting with strong contrast between shadow and light',
    'soft and diffuse light creating a serene atmosphere',
    'high contrast with areas of pure light and deep shadow',
    'chiaroscuro inspired by classical masters',
    'natural twilight light with golden and purple hues'
  ];
  
  const style = styles[randomFunc(0, styles.length - 1)];
  const shot = shots[randomFunc(0, shots.length - 1)];
  const lighting = lightings[randomFunc(0, lightings.length - 1)];
  const keyword1 = englishKeywords[randomFunc(0, englishKeywords.length - 1)];
  const keyword2 = englishKeywords[randomFunc(0, englishKeywords.length - 1)];
  const keyword3 = englishKeywords[randomFunc(0, englishKeywords.length - 1)];
  
  return `${keyword1}, ${keyword2}, ${keyword3}, ${shot}, ${lighting}, ${style}, detailed illustration, high quality, vibrant colors, dynamic composition, emotive facial expressions, rich background details, correct perspective, precise anatomy, clear visual storytelling`;
}

// Mettre à jour le gestionnaire d'événements pour le bouton de génération de scénario
document.addEventListener('DOMContentLoaded', function() {
  const generateScenarioBtn = document.getElementById('generate-scenario');
  if (generateScenarioBtn) {
    generateScenarioBtn.addEventListener('click', function() {
      const keywords = document.getElementById('keywords').value;
      if (!keywords) {
        alert('Veuillez entrer des mots-clés pour générer un scénario.');
        return;
      }
      
      // Générer l'histoire
      generateStory(keywords);
    });
  }
  
  // Ajouter des styles pour le spinner de chargement
  const style = document.createElement('style');
  style.textContent = `
    .loading-spinner {
      width: 40px;
      height: 40px;
      margin: 20px auto;
      border: 4px solid rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      border-top: 4px solid #2196F3;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
});
