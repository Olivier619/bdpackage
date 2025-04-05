// netlify/functions/generate-story.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Access your API key securely from environment variables
const apiKey = process.env.GOOGLE_API_KEY;

// --- Helper Function to Parse Gemini's **SIMPLIFIED** Outline Response ---
// (Only parses Title and Chapter Titles)
function parseSimplifiedOutline(text) {
    console.log("Attempting to parse SIMPLIFIED outline text:\n", text);
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let title = "N/A";
    const chapters = [];

    try {
        const titleMatch = text.match(/TITRE GLOBAL\s*:\s*(.*)/i);
        if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].trim();
            console.log("Parsed Global Title:", title);
        } else {
             const firstLineIsTitle = lines[0] && !lines[0].toLowerCase().startsWith("chapitre");
             if(firstLineIsTitle) title = lines[0];
             console.warn("Could not find 'TITRE GLOBAL:', using first line as potential title:", title);
        }

        for (let i = 0; i < lines.length; i++) {
            const chapterTitleMatch = lines[i].match(/CHAPITRE\s+(\d+)\s*:\s*(.*)/i);

            if (chapterTitleMatch && chapterTitleMatch[1] && chapterTitleMatch[2]) {
                const chapterNum = parseInt(chapterTitleMatch[1], 10);
                chapters.push({
                    chapter: chapterNum,
                    title: chapterTitleMatch[2].trim(),
                    summary: "" // Summary is no longer requested/parsed
                });
                console.log(`Parsed Chapter ${chapterNum} Title: ${chapterTitleMatch[2].trim()}`);
            }
            // No need to look for summaries anymore
        }

        chapters.sort((a, b) => a.chapter - b.chapter);
        console.log("Final Parsed Chapters (Titles Only):", chapters);

        if (title === "N/A" && chapters.length === 0) {
            throw new Error("Parsing failed completely. No title or chapters found.");
        }

        return { title, chapters };

    } catch (parseError) {
        console.error("Error during simplified outline parsing:", parseError);
        return { title: "Erreur Parsing", chapters: [], rawText: text, parsingError: parseError.message };
    }
}
// --- End Helper Function ---


exports.handler = async (event, context) => {
    // 1. Check for API Key (same as before)
    if (!apiKey) { /* ... */ return { statusCode: 500, body: JSON.stringify({ error: "API Key not configured." }) }; }

    // 2. Ensure POST (same as before)
    if (event.httpMethod !== "POST") { return { statusCode: 405, body: "Method Not Allowed" }; }

    // 3. Parse Input (same as before)
    let inputData;
    try { inputData = JSON.parse(event.body); } catch (error) { /* ... */ return { statusCode: 400, body: JSON.stringify({ error: "Bad request body." }) }; }

    const { keywords, genre, style, tone, details } = inputData;

    // 4. Validation (same as before)
    if (!keywords || !genre || !style || !tone) { return { statusCode: 400, body: JSON.stringify({ error: "Missing required input fields." }) }; }

    // 5. Construct the **EVEN SIMPLER OUTLINE PROMPT** for Gemini
    //    ******************************************************************
    console.log("--- CONSTRUCTING EVEN SIMPLER OUTLINE PROMPT (TITLES ONLY) ---");
    let prompt = `Tâche : Créer une **ossature TRÈS SIMPLE** pour une bande dessinée. NE PAS écrire les résumés ou le scénario complet, seulement l'organisation des titres.\n\n`;
    prompt += `INPUTS UTILISATEUR :\n`;
    prompt += `- Idée/Mots-clés : ${keywords}\n`;
    prompt += `- Genre : ${genre}\n`;
    prompt += `- Style Visuel Cible (pour info) : ${style}\n`;
    prompt += `- Ton : ${tone}\n`;
    if (details) {
        prompt += `- Détails Additionnels : ${details}\n`;
    }
    prompt += `\nINSTRUCTIONS SPÉCIFIQUES POUR L'OSSATURE SIMPLE :\n`;
    prompt += `1. **Langue : ÉCRIS TOUTE LA RÉPONSE EN FRANÇAIS.**\n`;
    prompt += `2. Crée un **TITRE GLOBAL** accrocheur pour la BD.\n`;
    prompt += `3. Divise l'histoire en environ **10 CHAPITRES** logiques.\n`;
    prompt += `4. Pour **CHAQUE chapitre**, fournis **UNIQUEMENT** :\n`; // Changed instruction
    prompt += `   - Un **TITRE DE CHAPITRE** clair et évocateur.\n`;
    prompt += `5. **NE PAS écrire les résumés de chapitre, ni dialogues, descriptions, etc.**\n`; // Reinforced exclusion
    prompt += `\nFORMAT DE SORTIE ATTENDU (IMPORTANT - Suivre ce format EXACTEMENT) :\n\n`;
    prompt += `TITRE GLOBAL : [Titre global ici en Français]\n\n`;
    prompt += `CHAPITRE 1 : [Titre Chapitre 1 en Français]\n`; // Removed summary line from format
    prompt += `CHAPITRE 2 : [Titre Chapitre 2 en Français]\n`; // Removed summary line from format
    prompt += `[...] (Continuer pour environ 10 chapitres)\n`;
    prompt += `CHAPITRE 10 : [Titre Chapitre 10 en Français]\n`; // Removed summary line from format
    prompt += `\n**RAPPEL FINAL : Génère UNIQUEMENT le titre global et les titres des chapitres en FRANÇAIS.**\n`; // Simplified reminder
    prompt += `OSSATURE SIMPLE CI-DESSOUS :\n`;
    prompt += `------------------------------------\n`;
    //    ******************************************************************

    console.log("Sending EVEN SIMPLER OUTLINE prompt to Gemini...");

    // 6. Initialize Google AI and Call the API (same as before)
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Gardez le modèle qui fonctionnait (pas d'erreur 404)
        const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" }); // Ou 1.0-pro si 1.5 timeoute encore

        const result = await model.generateContent(prompt);
        console.log("Received result object from Gemini (simple outline).");
        const response = await result.response;
        const text = response.text();

        // 7. Parse the Simplified Outline Text
        const parsedOutline = parseSimplifiedOutline(text); // Utilise la nouvelle fonction de parsing

        if (parsedOutline.parsingError) {
             console.warn("Simplified outline parsing failed, returning raw text.");
        } else {
             console.log("Simplified outline parsed successfully.");
        }

        // 8. Return the parsed outline
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ outline: parsedOutline }), // La structure de retour reste la même
        };

    } catch (error) {
        // Gérer les erreurs API (identique à avant, mais log spécifique)
        console.error("Error calling Google AI API (simple outline prompt):", error);
         let errorMessage = `API call failed: ${error.message}`;
          // ... (le reste du bloc catch reste identique) ...
          if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) { /* ... */ }
          else if (error.message.includes('API key not valid')) { /* ... */ }
          else if (error.status === 404) { /* ... */ }
          else { errorMessage = `API call failed: ${error.message}${error.status ? ` (Status: ${error.status})` : ''}`; }
        return {
            statusCode: error.status || 500,
            body: JSON.stringify({ error: "Failed to generate simple outline via API.", details: errorMessage }),
        };
    }
};
