// api/generate-chapter-detail.js
import { GoogleGenerativeAI } from "@google/generative-ai"; // Utiliser import

// Access your API key securely from environment variables
const apiKey = process.env.GOOGLE_API_KEY;

// --- VERCEL EXPORT DEFAULT ---
export default async function handler(request, response) {
    // 1. Check for API Key
    if (!apiKey) {
        console.error("ERROR: GOOGLE_API_KEY environment variable not set.");
        return response.status(500).json({ error: "API Key not configured." });
    }

    // 2. Ensure it's a POST request
    if (request.method !== "POST") {
        response.setHeader('Allow', ['POST']);
        return response.status(405).end('Method Not Allowed');
    }

    // 3. Get incoming data from the frontend (Vercel parses JSON)
    const inputData = request.body;
    console.log("Received request data for chapter detail:", inputData);

    // Destructure all expected data from request.body
    const {
        keywords, genre, style, tone, details,
        globalTitle, totalChapters,
        chapterNumber, chapterTitle, chapterSummary
    } = inputData || {}; // Ajouter un fallback {}

    // 4. Basic validation for required chapter detail context
    if (
        !keywords || !genre || !style || !tone || !globalTitle ||
        chapterNumber === undefined || chapterNumber === null || !chapterTitle
    ) {
        console.error("Missing required context fields for chapter detail generation:", { keywords, genre, style, tone, globalTitle, chapterNumber, chapterTitle });
        return response.status(400).json({ error: "Missing required context for chapter detail." });
    }

    // 5. Construct the Prompt for Gemini to generate **ONE CHAPTER DETAIL**
    //    (Utilise le prompt détaillé, mais demande explicitement peu de pages)
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
    prompt += `2.  **Concentration : Ne détaille QUE et UNIQUEMENT le Chapitre ${chapterNumber} ("${chapterTitle}").**\n`;
    // -- MODIFICATION POUR TESTER RAPIDITÉ --
    prompt += `3.  **Découpage :** Découpe le contenu de ce chapitre en **Pages** (vise **1 ou 2 pages MAXIMUM** pour ce chapitre. Sois concis).\n`;
    prompt += `4.  Pour **CHAQUE page**, découpe-la en **Cases** (Panel en anglais). Vise un **faible nombre de cases** par page (ex: **2 à 4 MAXIMUM**).\n`;
    // -- FIN MODIFICATION --
    prompt += `5.  Pour **CHAQUE case**, fournis au minimum une **Description** visuelle. Ajoute **Dialogue** et **Pensées** seulement si c'est crucial pour l'action.\n`;
    prompt += `6.  **Clarté du Format :** Utilise une structure claire pour séparer les pages et les cases.\n`;
    prompt += `\nFORMAT DE SORTIE ATTENDU POUR CE CHAPITRE (IMPORTANT - Suivre ce format aussi précisément que possible) :\n\n`;
    prompt += `PAGE 1\n`;
    prompt += `Case 1: [Description visuelle de la case 1].\n`;
    prompt += `    PERSONNAGE A: "Dialogue ici."\n`;
    prompt += `    PERSONNAGE B: "Autre dialogue."\n`;
    prompt += `    (Pensée du Personnage A ici.)\n`;
    prompt += `Case 2: [Description visuelle de la case 2].\n`;
    prompt += `[...] (Continuer pour toutes les cases de la Page 1)\n\n`;
    prompt += `PAGE 2\n`; // Exemple si 2 pages
    prompt += `Case 1: [Description visuelle de la case 1 de la page 2].\n`;
    prompt += `[...] (Continuer pour toutes les cases et toutes les pages de ce chapitre)\n\n`;
    prompt += `PAGE [Dernier numéro de page du chapitre]\n`;
    prompt += `Case [...]: [Description de la dernière case].\n`;
    prompt += `\n**RAPPEL FINAL : Détaille UNIQUEMENT le Chapitre ${chapterNumber} en FRANÇAIS, en suivant le format Page/Case et les instructions de longueur.**\n`;
    prompt += `SCÉNARIO DÉTAILLÉ DU CHAPITRE ${chapterNumber} CI-DESSOUS :\n`;
    prompt += `------------------------------------\n`;
    //    ******************************************************************

    console.log(`Sending DETAIL prompt for Chapter ${chapterNumber} to Gemini...`);

    // 6. Initialize Google AI and Call the API
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Utiliser le modèle qui ne donne pas 404 (même s'il est lent)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

        const result = await model.generateContent(prompt);
        console.log(`Received result object from Gemini (Chapter ${chapterNumber} detail).`);
        const geminiResponse = await result.response; // Renommé
        const text = geminiResponse.text();

        console.log(`Received detailed text for Chapter ${chapterNumber}. Length: ${text.length}`);

        // 7. Return the successful response (raw text) using Vercel syntax
        return response.status(200).json({ scenarioText: text });

    } catch (error) {
        // Gérer les erreurs API
        console.error(`Error calling Google AI API (Chapter ${chapterNumber} detail):`, error);
        let errorMessage = `API call failed: ${error.message}`;
        let statusCode = 500; // Default

         // Adapter la gestion d'erreur si nécessaire
         if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) {
             errorMessage = `La génération a été bloquée par Google pour la raison : ${error.response.promptFeedback.blockReason}`;
             statusCode = 400;
         } else if (error.message?.includes('API key not valid')) {
             errorMessage = "La clé API Google configurée n'est pas valide.";
             statusCode = 500;
         } else if (error.status === 404) {
              errorMessage = `API call failed: ${error.message} (Vérifiez le nom du modèle: 'gemini-1.5-pro-latest'?)`;
              statusCode = 404;
         } else if (error.status) {
             errorMessage = `API call failed: ${error.message}`;
             statusCode = error.status;
         }
          // Renvoyer l'erreur avec la syntaxe Vercel
        return response.status(statusCode).json({ error: `Failed to generate detail for chapter ${chapterNumber} via API.`, details: errorMessage });
    }
}
