// netlify/functions/generate-story.js
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Access your API key securely from environment variables
const apiKey = process.env.GOOGLE_API_KEY;

// --- Helper Function to Parse Gemini's Outline Response ---
// (This is a basic parser, might need adjustments based on Gemini's actual output)
function parseOutline(text) {
    console.log("Attempting to parse outline text:\n", text);
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let title = "N/A";
    const chapters = [];
    let currentChapter = null;

    try {
        const titleMatch = text.match(/TITRE GLOBAL\s*:\s*(.*)/i);
        if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].trim();
            console.log("Parsed Global Title:", title);
        } else {
             // Fallback if TITRE GLOBAL isn't found exactly
             const firstLineIsTitle = lines[0] && !lines[0].toLowerCase().startsWith("chapitre") && !lines[0].toLowerCase().startsWith("résumé");
             if(firstLineIsTitle) title = lines[0];
             console.warn("Could not find 'TITRE GLOBAL:', using first line as potential title:", title);
        }


        for (let i = 0; i < lines.length; i++) {
            const chapterTitleMatch = lines[i].match(/CHAPITRE\s+(\d+)\s*:\s*(.*)/i);
            const chapterSummaryMatch = lines[i].match(/RÉSUMÉ CHAPITRE\s+(\d+)\s*:\s*(.*)/i);

            if (chapterTitleMatch && chapterTitleMatch[1] && chapterTitleMatch[2]) {
                currentChapter = parseInt(chapterTitleMatch[1], 10);
                // Check if chapter already exists (in case title/summary are separated)
                let existingChapter = chapters.find(ch => ch.chapter === currentChapter);
                if (!existingChapter) {
                     chapters.push({
                         chapter: currentChapter,
                         title: chapterTitleMatch[2].trim(),
                         summary: "..." // Placeholder
                     });
                     console.log(`Parsed Chapter ${currentChapter} Title: ${chapterTitleMatch[2].trim()}`);
                } else {
                    existingChapter.title = chapterTitleMatch[2].trim();
                     console.log(`Updated Chapter ${currentChapter} Title: ${chapterTitleMatch[2].trim()}`);
                }

            } else if (chapterSummaryMatch && chapterSummaryMatch[1] && chapterSummaryMatch[2]) {
                 const summaryChapterNum = parseInt(chapterSummaryMatch[1], 10);
                 let chapterToUpdate = chapters.find(ch => ch.chapter === summaryChapterNum);
                 if(chapterToUpdate) {
                     chapterToUpdate.summary = chapterSummaryMatch[2].trim();
                     console.log(`Parsed Chapter ${summaryChapterNum} Summary: ${chapterSummaryMatch[2].trim()}`);
                 } else {
                     // Summary found before title? Less likely with the requested format, but handle defensively
                     chapters.push({
                         chapter: summaryChapterNum,
                         title: `Chapitre ${summaryChapterNum} (Titre manquant)`,
                         summary: chapterSummaryMatch[2].trim()
                     });
                     console.warn(`Parsed Chapter ${summaryChapterNum} Summary found before title.`);
                 }
                 currentChapter = null; // Reset after finding summary
            }
        }

        // Sort chapters just in case parsing order was weird
        chapters.sort((a, b) => a.chapter - b.chapter);

        console.log("Final Parsed Chapters:", chapters);

        if (title === "N/A" && chapters.length === 0) {
            throw new Error("Parsing failed completely. No title or chapters found.");
        }

        return { title, chapters };

    } catch (parseError) {
        console.error("Error during outline parsing:", parseError);
        // Return raw text if parsing fails, with an error flag
        return { title: "Erreur Parsing", chapters: [], rawText: text, parsingError: parseError.message };
    }
}
// --- End Helper Function ---


exports.handler = async (event, context) => {
    // 1. Check for API Key (same as before)
    if (!apiKey) {
        console.error("ERROR: GOOGLE_API_KEY environment variable not set.");
        return { statusCode: 500, body: JSON.stringify({ error: "API Key not configured." }) };
    }

    // 2. Ensure POST (same as before)
    if (event.httpMethod !== "POST") {
        return { statusCode: 405, body: "Method Not Allowed" };
    }

    // 3. Parse Input (same as before)
    let inputData;
    try {
        inputData = JSON.parse(event.body);
    } catch (error) {
        console.error("Error parsing request body:", error);
        return { statusCode: 400, body: JSON.stringify({ error: "Bad request body." }) };
    }

    // Use all relevant inputs for context
    const { keywords, genre, style, tone, details } = inputData;

    // 4. Validation (same as before)
    if (!keywords || !genre || !style || !tone) {
        return { statusCode: 400, body: JSON.stringify({ error: "Missing required input fields." }) };
    }

    // 5. Construct the **OUTLINE PROMPT** for Gemini
    //    ******************************************************************
    console.log("--- CONSTRUCTING OUTLINE PROMPT ---");
    let prompt = `Tâche : Créer une **ossature détaillée** pour une bande dessinée d'environ 48 pages. NE PAS écrire le scénario complet, seulement l'organisation.\n\n`;
    prompt += `INPUTS UTILISATEUR :\n`;
    prompt += `- Idée/Mots-clés : ${keywords}\n`;
    prompt += `- Genre : ${genre}\n`;
    prompt += `- Style Visuel Cible (pour info) : ${style}\n`;
    prompt += `- Ton : ${tone}\n`;
    if (details) {
        prompt += `- Détails Additionnels : ${details}\n`;
    }
    prompt += `\nINSTRUCTIONS SPÉCIFIQUES POUR L'OSSATURE :\n`;
    prompt += `1. **Langue : ÉCRIS TOUTE LA RÉPONSE EN FRANÇAIS.**\n`;
    prompt += `2. Crée un **TITRE GLOBAL** accrocheur pour la BD.\n`;
    prompt += `3. Divise l'histoire en environ **10 CHAPITRES** logiques (pour viser 4-5 pages de BD par chapitre).\n`;
    prompt += `4. Pour **CHAQUE chapitre**, fournis :\n`;
    prompt += `   - Un **TITRE DE CHAPITRE** clair et évocateur.\n`;
    prompt += `   - Un **RÉSUMÉ DE CHAPITRE** très court (**1 à 2 phrases MAXIMUM**) décrivant l'événement principal ou le but de ce chapitre.\n`;
    prompt += `5. **NE PAS écrire les dialogues, descriptions de cases, ou le scénario détaillé des chapitres.**\n`;
    prompt += `\nFORMAT DE SORTIE ATTENDU (IMPORTANT - Suivre ce format EXACTEMENT) :\n\n`;
    prompt += `TITRE GLOBAL : [Titre global ici en Français]\n\n`;
    prompt += `CHAPITRE 1 : [Titre Chapitre 1 en Français]\n`;
    prompt += `RÉSUMÉ CHAPITRE 1 : [Résumé 1-2 phrases en Français]\n\n`;
    prompt += `CHAPITRE 2 : [Titre Chapitre 2 en Français]\n`;
    prompt += `RÉSUMÉ CHAPITRE 2 : [Résumé 1-2 phrases en Français]\n\n`;
    prompt += `[...] (Continuer pour environ 10 chapitres)\n\n`;
    prompt += `CHAPITRE 10 : [Titre Chapitre 10 en Français]\n`;
    prompt += `RÉSUMÉ CHAPITRE 10 : [Résumé 1-2 phrases en Français]\n\n`;
    prompt += `**RAPPEL FINAL : Génère UNIQUEMENT l'ossature (titre global, titres chapitres, résumés courts) en FRANÇAIS et respecte le format demandé.**\n`;
    prompt += `OSSATURE CI-DESSOUS :\n`;
    prompt += `------------------------------------\n`;
    //    ******************************************************************

    console.log("Sending OUTLINE prompt to Gemini...");

    // 6. Initialize Google AI and Call the API (same as before)
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Utiliser le modèle qui fonctionne (pas d'erreur 404)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" }); // Ou 1.0-pro

        const result = await model.generateContent(prompt); // Appel avec le prompt d'OSSATURE
        console.log("Received result object from Gemini (outline prompt).");
        const response = await result.response;
        const text = response.text(); // Récupère le texte brut de l'IA

        // 7. Parse the Outline Text into JSON
        const parsedOutline = parseOutline(text); // Utilise la fonction helper

        if (parsedOutline.parsingError) {
             console.warn("Outline parsing failed, returning raw text along with error.");
             // Optionally, decide if you want to return a different status code on parsing failure
        } else {
             console.log("Outline parsed successfully.");
        }


        // 8. Return the parsed outline (or raw text on failure)
        return {
            statusCode: 200, // Success from API, even if parsing failed client-side can handle rawText
            headers: { "Content-Type": "application/json" },
            // Envoie l'objet JSON parsé (qui contient titre, chapters, et potentiellement rawText/parsingError)
            body: JSON.stringify({ outline: parsedOutline }),
        };

    } catch (error) {
        // Gérer les erreurs API (identique à avant, mais log spécifique)
        console.error("Error calling Google AI API (outline prompt):", error);
         let errorMessage = `API call failed: ${error.message}`;
          if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) {
             errorMessage = `La génération a été bloquée par Google pour la raison : ${error.response.promptFeedback.blockReason}`;
         } else if (error.message.includes('API key not valid')) {
             errorMessage = "La clé API Google configurée n'est pas valide.";
         } else if (error.status === 404) {
              errorMessage = `API call failed: ${error.message} (Vérifiez le nom du modèle: 'gemini-1.5-pro-latest' ou 'gemini-1.0-pro'?)`;
         } else {
             // Add status code to general message if available
             errorMessage = `API call failed: ${error.message}${error.status ? ` (Status: ${error.status})` : ''}`;
         }
        return {
            statusCode: error.status || 500, // Use error status if available, otherwise 500
            body: JSON.stringify({ error: "Failed to generate outline via API.", details: errorMessage }),
        };
    }
};
