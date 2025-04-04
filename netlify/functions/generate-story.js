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

    // !! IMPORTANT: Utilisez seulement les inputs nécessaires pour le test simple !!
    const { keywords, genre } = inputData; // On a juste besoin de ça pour le test

    // 4. Basic validation (simplifiée pour le test)
    if (!keywords || !genre ) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing required input fields for simple test." }) };
    }

    // 5. Construct the **SIMPLE TEST PROMPT** for Gemini
    //    (On remplace tout le prompt complexe par ceci pour tester le timeout)
    //    ******************************************************************
    console.log("--- USING SIMPLE PROMPT FOR TIMEOUT TEST ---"); // Log pour savoir qu'on utilise le test
    let prompt = `Tâche : Écris juste un titre accrocheur en FRANÇAIS pour une bande dessinée.\n\n`;
    prompt += `INPUTS UTILISATEUR (simplifié) :\n`;
    prompt += `- Idée/Mots-clés : ${keywords}\n`;
    prompt += `- Genre : ${genre}\n\n`;
    prompt += `FORMAT DE SORTIE ATTENDU :\n`;
    prompt += `TITRE : [Titre de la BD en Français]\n\n`; // Demande juste le titre
    prompt += `TITRE CI-DESSOUS :\n`;
    prompt += `------------------------------------\n`;
    //    ******************************************************************

    console.log("Sending SIMPLE prompt to Gemini..."); // Log avant l'appel

    // 6. Initialize Google AI and Call the API
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // !!! Assurez-vous d'utiliser le modèle qui ne causait PAS l'erreur 404 !!!
        // !!!       'gemini-1.5-pro-latest' ou 'gemini-1.0-pro'        !!!
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

        const result = await model.generateContent(prompt); // Appel avec le prompt SIMPLE
        console.log("Received result object from Gemini (simple prompt)."); // Log après succès
        const response = await result.response;
        const text = response.text();

        console.log("Received simple response text from Gemini."); // Log

        // 7. Return the successful response to the frontend
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            // On renvoie juste le texte brut (qui devrait être très court)
            body: JSON.stringify({ scenarioText: `--- TEST RESPONSE --- \n${text}` }),
        };

    } catch (error) {
        console.error("Error calling Google AI API (simple prompt test):", error); // Log d'erreur
        // Check for specific Gemini errors if possible
         let errorMessage = `API call failed: ${error.message}`;
         if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) {
             errorMessage = `La génération a été bloquée par Google pour la raison : ${error.response.promptFeedback.blockReason}`;
         } else if (error.message.includes('API key not valid')) {
             errorMessage = "La clé API Google configurée n'est pas valide.";
         } else if (error.status === 404) {
              errorMessage = `API call failed: ${error.message} (Vérifiez le nom du modèle: 'gemini-1.5-pro-latest' ou 'gemini-1.0-pro'?)`;
         }
        return {
            statusCode: 500, // Peut toujours être 500 ou un autre code selon l'erreur Google
            body: JSON.stringify({ error: "Failed to generate simple test response via API.", details: errorMessage }),
        };
    }
};
