// netlify/functions/generate-story.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Access your API key securely from environment variables
const apiKey = process.env.GOOGLE_API_KEY;

exports.handler = async (event, context) => {
    // 1. Check for API Key
    if (!apiKey) {
        console.error("ERROR: GOOGLE_API_KEY environment variable not set.");
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "API Key not configured on the server." }),
        };
    }

    // 2. Ensure it's a POST request (optional but good practice)
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    // 3. Parse incoming data from the frontend
    let inputData;
    try {
        inputData = JSON.parse(event.body);
    } catch (error) {
        console.error("Error parsing request body:", error);
        return { statusCode: 400, body: JSON.stringify({ error: "Bad request body." }) };
    }

    const { keywords, genre, style, tone, details } = inputData;

    // 4. Basic validation (optional)
    if (!keywords || !genre || !style || !tone) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing required input fields." }) };
    }

    // 5. Construct the Prompt for Gemini 1.0 Pro
    //    (Using the detailed prompt structure we developed before)
    let prompt = `Tâche : Écrire un scénario détaillé pour une bande dessinée. **IMPORTANT : La réponse COMPLÈTE doit être en FRANÇAIS.**\n\n`;
    prompt += `INPUTS UTILISATEUR :\n`;
    prompt += `- Idée/Mots-clés : ${keywords}\n`;
    prompt += `- Genre : ${genre}\n`;
    prompt += `- Style Visuel Cible (pour info) : ${style}\n`;
    prompt += `- Ton : ${tone}\n`;
    if (details) {
        prompt += `- Détails Additionnels (Personnages, Univers) : ${details}\n`;
    }
    prompt += `\nINSTRUCTIONS (Suivre attentivement) :\n`;
    prompt += `1. **Langue : ÉCRIS TOUTE LA RÉPONSE EN FRANÇAIS.**\n`;
    prompt += `2. Crée un titre accrocheur en FRANÇAIS.\n`;
    prompt += `3. Écris un synopsis court (2-3 paragraphes) en FRANÇAIS.\n`;
    // ... (include ALL the detailed instructions from your previous prompt)
    prompt += `FORMAT DE SORTIE ATTENDU (IMPORTANT - Suivre ce format EXACTEMENT) :\n`;
    prompt += `TITRE : [Titre de la BD en Français]\n\n`;
    prompt += `SYNOPSIS :\n[Synopsis en Français ici]\n\n`;
    prompt += `CHAPITRE 1 : [Titre du Chapitre 1 en Français]\n`;
    // ... (include the full format example)
    prompt += `**RAPPEL FINAL : TOUTE LA RÉPONSE DOIT ÊTRE EN FRANÇAIS.**\n`;
    prompt += `SCÉNARIO COMPLET CI-DESSOUS :\n`;
    prompt += `------------------------------------\n`;

    console.log("Sending prompt to Gemini..."); // Log on the serverless function side

    // 6. Initialize Google AI and Call the API
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
 const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        console.log("Received response from Gemini."); // Server log

        // 7. Return the successful response to the frontend
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ scenarioText: text }), // Send the raw text back
        };

    } catch (error) {
        console.error("Error calling Google AI API:", error);
        // Check for specific Gemini errors if possible (e.g., safety blocks)
         let errorMessage = `API call failed: ${error.message}`;
         if (error.message.includes('SAFETY')) {
             errorMessage = "La génération a été bloquée pour des raisons de sécurité par l'API Google.";
         } else if (error.message.includes('API key not valid')) {
             errorMessage = "La clé API Google configurée n'est pas valide.";
         }
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to generate scenario via API.", details: errorMessage }),
        };
    }
};
