// api/generate-chapter-detail.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY;

export default async function handler(request, response) {
    if (!apiKey) { console.error("API Key missing"); return response.status(500).json({ error: "API Key not configured." }); }
    if (request.method !== "POST") { response.setHeader('Allow', ['POST']); return response.status(405).end('Method Not Allowed'); }

    const inputData = request.body;
    console.log("Received request data for chapter detail:", inputData);
    const { keywords, genre, style, tone, details, globalTitle, totalChapters, chapterNumber, chapterTitle, chapterSummary } = inputData || {};

    if (!keywords || !genre || !style || !tone || !globalTitle || chapterNumber === undefined || chapterNumber === null || !chapterTitle ) {
        console.error("Missing context for chapter detail:", { keywords, genre, style, tone, globalTitle, chapterNumber, chapterTitle });
        return response.status(400).json({ error: "Missing required context for chapter detail." });
    }

    console.log(`--- CONSTRUCTING DETAIL PROMPT for Chapter ${chapterNumber} ---`);
    let prompt = `Tâche : Écrire le scénario **détaillé** pour **UN SEUL CHAPITRE** d'une bande dessinée, en suivant le format Page/Case.\n\nCONTEXTE GÉNÉRAL DE LA BD :\n- Titre Global : ${globalTitle}\n- Idée/Mots-clés : ${keywords}\n- Genre : ${genre}\n- Style Visuel Cible (pour info) : ${style}\n- Ton : ${tone}\n`;
    if (details) { prompt += `- Détails Additionnels : ${details}\n`; }
    prompt += `- Nombre Total de Chapitres prévus : ${totalChapters || 'N/A'}\n\nCONTEXTE SPÉCIFIQUE DU CHAPITRE À DÉTAILLER :\n- Numéro du Chapitre : ${chapterNumber}\n- Titre du Chapitre : ${chapterTitle}\n`;
    if (chapterSummary) { prompt += `- Résumé Court du Chapitre (guide) : ${chapterSummary}\n`; }
    prompt += `\nINSTRUCTIONS POUR LE SCÉNARIO DÉTAILLÉ (Suivre attentivement) :\n1. **Langue : ÉCRIS TOUTE LA RÉPONSE EN FRANÇAIS.**\n2. **Concentration : Ne détaille QUE et UNIQUEMENT le Chapitre ${chapterNumber} ("${chapterTitle}").**\n3. **Découpage Pages :** Découpe le contenu en **Pages** (vise **1 ou 2 pages MAXIMUM**).\n4. **Découpage Cases :** Pour **CHAQUE page**, découpe-la en **Cases** (vise **2 à 4 MAXIMUM** par page).\n5. **Contenu Case :** Pour **CHAQUE case**, fournis au minimum une **Description** visuelle. Ajoute **Dialogue** et **Pensées** si crucial.\n6. **Clarté Format :** Utilise une structure claire.\n\nFORMAT DE SORTIE ATTENDU POUR CE CHAPITRE (Suivre précisément) :\n\nPAGE 1\nCase 1: [Description case 1].\n    PERSONNAGE: "Dialogue."\n    (Pensée.)\nCase 2: [Description case 2].\n[...]\n\nPAGE 2\nCase 1: [Description case 1 page 2].\n[...]\n\nPAGE [Dernière page]\nCase [...]: [Dernière case].\n\n**RAPPEL FINAL : Détaille UNIQUEMENT le Chapitre ${chapterNumber} en FRANÇAIS, format Page/Case, longueur limitée.**\nSCÉNARIO DÉTAILLÉ DU CHAPITRE ${chapterNumber} CI-DESSOUS :\n------------------------------------\n`;

    console.log(`Sending DETAIL prompt for Chapter ${chapterNumber} to Gemini...`);

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Utiliser gemini-1.5-pro-latest car 1.0 donnait 404
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

        const result = await model.generateContent(prompt);
        console.log(`Received result object from Gemini (Chapter ${chapterNumber} detail).`);
        const geminiResponse = await result.response;
        const text = geminiResponse.text();

        console.log(`Received detailed text for Chapter ${chapterNumber}. Length: ${text.length}`);

        return response.status(200).json({ scenarioText: text }); // Renvoyer texte brut

    } catch (error) {
        console.error(`Error calling Google AI API (Chapter ${chapterNumber} detail):`, error);
        let errorMessage = `API call failed: ${error.message}`;
        let statusCode = 500;
         if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) { errorMessage = `Blocage Google : ${error.response.promptFeedback.blockReason}`; statusCode = 400; }
         else if (error.message?.includes('API key not valid')) { errorMessage = "Clé API invalide."; statusCode = 500; }
         else if (error.status === 404) { errorMessage = `Modèle non trouvé: ${error.message}`; statusCode = 404; }
         else if (error.status) { errorMessage = `Erreur API: ${error.message}`; statusCode = error.status; }
        return response.status(statusCode).json({ error: `Échec génération détail chap. ${chapterNumber}.`, details: errorMessage });
    }
}
