// netlify/functions/generate-chapter-detail.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Access your API key securely from environment variables
const apiKey = process.env.GOOGLE_API_KEY;

exports.handler = async (event, context) => {
    // 1. Check for API Key
    if (!apiKey) {
        console.error("ERROR: GOOGLE_API_KEY environment variable not set.");
        return { statusCode: 500, body: JSON.stringify({ error: "API Key not configured." }) };
    }

    // 2. Ensure it's a POST request
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    // 3. Parse incoming data from the frontend
    let inputData;
    try {
        inputData = JSON.parse(event.body);
        console.log("Received request data for chapter detail:", inputData); // Log received data
    } catch (error) {
        console.error("Error parsing request body for chapter detail:", error);
        return { statusCode: 400, body: JSON.stringify({ error: "Bad request body." }) };
    }

    // Destructure all expected data from the frontend
    const {
        keywords, genre, style, tone, details,
        globalTitle, totalChapters,
        chapterNumber, chapterTitle, chapterSummary
    } = inputData;

    // 4. Basic validation for required chapter detail context
    if (
        !keywords || !genre || !style || !tone || !globalTitle ||
        chapterNumber === undefined || chapterNumber === null || !chapterTitle
    ) {
        console.error("Missing required context fields for chapter detail generation:", { keywords, genre, style, tone, globalTitle, chapterNumber, chapterTitle });
        return { statusCode: 400, body: JSON.stringify({ error: "Missing required context for chapter detail." }) };
    }

    // 5. Construct the Prompt for Gemini to generate **ONE CHAPTER DETAIL**
    //    ******************************************************************
    console.log(`--- CONSTRUCTING DETAIL PROMPT for Chapter ${chapterNumber} ---`);
    let prompt = `Tâche : Écrire le scénario **détaillé** pour **UN SEUL CHAPITRE** d'une bande dessinée, en suivant le format Page/Case.\n\n`;
    prompt += `CONTEXTE GÉNÉRAL DE LA BD :\n`;
    prompt += `- Titre Global : ${globalTitle}\n`;
    prompt += `- Idée/Mots-clés : ${keywords}\n`;
    prompt += `- Genre : ${genre}\n`;
    prompt += `- Style Visuel Cible (pour info) : ${style}\n`;
    prompt += `- Ton : ${tone}\n`;
    if (details) {
        prompt += `- Détails Additionnels (Personnages, Univers) : ${details}\n`;
    }
    prompt += `- Nombre Total de Chapitres prévus : ${totalChapters || 'N/A'}\n`;
    prompt += `\nCONTEXTE SPÉCIFIQUE DU CHAPITRE À DÉTAILLER :\n`;
    prompt += `- Numéro du Chapitre : ${chapterNumber}\n`;
    prompt += `- Titre du Chapitre : ${chapterTitle}\n`;
    if (chapterSummary) {
        prompt += `- Résumé Court du Chapitre (guide) : ${chapterSummary}\n`;
    }
    prompt += `\nINSTRUCTIONS POUR LE SCÉNARIO DÉTAILLÉ (Suivre attentivement) :\n`;
    prompt += `1.  **Langue : ÉCRIS TOUTE LA RÉPONSE EN FRANÇAIS.**\n`;
    prompt += `2.  **Concentration : Ne détaille QUE et UNIQUEMENT le Chapitre ${chapterNumber} ("${chapterTitle}"). NE PAS inclure d'autres chapitres.**\n`;
    prompt += `3.  **Découpage :** Découpe le contenu de ce chapitre en **Pages** (environ 2-3 pages pour ce chapitre si possible, mais ajuste selon l'histoire).\n`;
    prompt += `4.  Pour **CHAQUE page**, découpe-la en **Cases** (Panel en anglais). Vise un nombre raisonnable de cases par page (ex: 3 à 6).\n`;
    prompt += `5.  Pour **CHAQUE case**, fournis :\n`;
    prompt += `    *   Une **Description** visuelle claire et concise (personnages, action, décor, cadrage si pertinent).\n`;
    prompt += `    *   Le **Dialogue** des personnages (s'il y en a), clairement indiqué (ex: PERSONNAGE: "Texte du dialogue").\n`;
    prompt += `    *   Les **Pensées** des personnages (si pertinent), indiquées entre parenthèses (ex: (Texte de la pensée)).\n`;
    prompt += `6.  **Clarté du Format :** Utilise une structure claire pour séparer les pages et les cases.\n`;
    prompt += `\nFORMAT DE SORTIE ATTENDU POUR CE CHAPITRE (IMPORTANT - Suivre ce format aussi précisément que possible) :\n\n`;
    // Note: On ne redemande pas le titre du chapitre en header, on se concentre sur Pages/Cases
    prompt += `PAGE 1\n`; // Commencer directement par la première page du chapitre
    prompt += `Case 1: [Description visuelle de la case 1].\n`;
    prompt += `    PERSONNAGE A: "Dialogue ici."\n`;
    prompt += `    PERSONNAGE B: "Autre dialogue."\n`;
    prompt += `    (Pensée du Personnage A ici.)\n`;
    prompt += `Case 2: [Description visuelle de la case 2].\n`;
    prompt += `    PERSONNAGE A: "Suite du dialogue."\n`;
    prompt += `[...] (Continuer pour toutes les cases de la Page 1)\n\n`;
    prompt += `PAGE 2\n`;
    prompt += `Case 1: [Description visuelle de la case 1 de la page 2].\n`;
    prompt += `[...] (Continuer pour toutes les cases et toutes les pages de ce chapitre)\n\n`;
    prompt += `PAGE [Dernier numéro de page du chapitre]\n`;
    prompt += `Case [...]: [Description de la dernière case].\n`;
    prompt += `\n**RAPPEL FINAL : Détaille UNIQUEMENT le Chapitre ${chapterNumber} en FRANÇAIS, en suivant le format Page/Case.**\n`;
    prompt += `SCÉNARIO DÉTAILLÉ DU CHAPITRE ${chapterNumber} CI-DESSOUS :\n`;
    prompt += `------------------------------------\n`;
    //    ******************************************************************

    console.log(`Sending DETAIL prompt for Chapter ${chapterNumber} to Gemini...`);

    // 6. Initialize Google AI and Call the API
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Utiliser le modèle qui fonctionne le mieux (1.0-pro semblait ok)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

        const result = await model.generateContent(prompt);
        console.log(`Received result object from Gemini (Chapter ${chapterNumber} detail).`);
        const response = await result.response;
        const text = response.text(); // Récupère le texte brut du scénario détaillé

        console.log(`Received detailed text for Chapter ${chapterNumber}. Length: ${text.length}`);

        // 7. Return the successful response (raw text of the detailed chapter)
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            // Renvoie juste le texte brut du chapitre détaillé.
            // Le frontend devra peut-être le parser s'il veut une structure plus fine.
            body: JSON.stringify({ scenarioText: text }),
        };

    } catch (error) {
        // Gérer les erreurs API
        console.error(`Error calling Google AI API (Chapter ${chapterNumber} detail):`, error);
         let errorMessage = `API call failed: ${error.message}`;
          // ... (Copier/Coller le même bloc de gestion d'erreur détaillé que dans l'autre fonction) ...
          if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) {
             errorMessage = `La génération a été bloquée par Google pour la raison : ${error.response.promptFeedback.blockReason}`;
         } else if (error.message.includes('API key not valid')) {
             errorMessage = "La clé API Google configurée n'est pas valide.";
         } else if (error.status === 404) {
              errorMessage = `API call failed: ${error.message} (Vérifiez le nom du modèle: 'gemini-1.0-pro'?)`;
         } else {
             errorMessage = `API call failed: ${error.message}${error.status ? ` (Status: ${error.status})` : ''}`;
         }
        return {
            statusCode: error.status || 500,
            body: JSON.stringify({ error: `Failed to generate detail for chapter ${chapterNumber} via API.`, details: errorMessage }),
        };
    }
};
