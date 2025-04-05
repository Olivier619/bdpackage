// api/generate-story.js
import { GoogleGenerativeAI } from "@google/generative-ai"; // Utiliser import

// Access your API key securely from environment variables
const apiKey = process.env.GOOGLE_API_KEY;

// --- Helper Function (identique, mais assurez-vous qu'elle est dans ce fichier ou importée) ---
function parseSimplifiedOutline(text) {
    // ... (code de la fonction parseSimplifiedOutline - voir version précédente) ...
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
                chapters.push({ chapter: chapterNum, title: chapterTitleMatch[2].trim(), summary: "" });
                console.log(`Parsed Chapter ${chapterNum} Title: ${chapterTitleMatch[2].trim()}`);
            }
        }
        chapters.sort((a, b) => a.chapter - b.chapter);
        console.log("Final Parsed Chapters (Titles Only):", chapters);
        if (title === "N/A" && chapters.length === 0) { throw new Error("Parsing failed completely."); }
        return { title, chapters };
    } catch (parseError) {
        console.error("Error during simplified outline parsing:", parseError);
        return { title: "Erreur Parsing", chapters: [], rawText: text, parsingError: parseError.message };
    }
}
// --- End Helper Function ---


// --- VERCEL EXPORT DEFAULT ---
export default async function handler(request, response) {
    // 1. Check for API Key
    if (!apiKey) {
        console.error("ERROR: GOOGLE_API_KEY environment variable not set.");
        // Vercel response syntax
        return response.status(500).json({ error: "API Key not configured." });
    }

    // 2. Ensure it's a POST request
    if (request.method !== "POST") {
        response.setHeader('Allow', ['POST']);
        return response.status(405).end('Method Not Allowed');
    }

    // 3. Get incoming data (Vercel usually parses JSON automatically)
    const inputData = request.body; // Accéder directement à request.body
    console.log("Received request data (outline):", inputData);

    // Destructure directement depuis request.body
    const { keywords, genre, style, tone, details } = inputData || {}; // Ajouter un fallback {}

    // 4. Basic validation
    if (!keywords || !genre || !style || !tone) {
         console.error("Missing required fields:", { keywords, genre, style, tone });
        return response.status(400).json({ error: "Missing required input fields." });
    }

    // 5. Construct the **EVEN SIMPLER OUTLINE PROMPT** (identique à avant)
    //    ******************************************************************
    console.log("--- CONSTRUCTING EVEN SIMPLER OUTLINE PROMPT (TITLES ONLY) ---");
    let prompt = `Tâche : Créer une **ossature TRÈS SIMPLE** pour une bande dessinée...`; // Prompt complet comme avant
    prompt += `INPUTS UTILISATEUR :\n`;
    prompt += `- Idée/Mots-clés : ${keywords}\n`;
    // ... (reste de la construction du prompt) ...
    prompt += `------------------------------------\n`;
    //    ******************************************************************

    console.log("Sending EVEN SIMPLER OUTLINE prompt to Gemini...");

    // 6. Initialize Google AI and Call the API
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Utiliser le modèle qui fonctionne (pas 404) mais qui peut être lent
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" }); // <-- Remis 1.5 en espérant que le timeout Vercel soit plus long

        const result = await model.generateContent(prompt);
        console.log("Received result object from Gemini (simple outline).");
        const geminiResponse = await result.response; // Renommé pour éviter conflit avec l'objet response Vercel
        const text = geminiResponse.text();

        // 7. Parse the Simplified Outline Text
        const parsedOutline = parseSimplifiedOutline(text);

        if (parsedOutline.parsingError) {
             console.warn("Simplified outline parsing failed, returning raw text.");
        } else {
             console.log("Simplified outline parsed successfully.");
        }

        // 8. Return the successful parsed outline (Vercel response)
        return response.status(200).json({ outline: parsedOutline });

    } catch (error) {
        // Gérer les erreurs API
        console.error("Error calling Google AI API (simple outline prompt):", error);
         let errorMessage = `API call failed: ${error.message}`;
         let statusCode = 500; // Default status code

          // Adapter la gestion d'erreur si nécessaire (la logique reste similaire)
          if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) {
             errorMessage = `La génération a été bloquée par Google pour la raison : ${error.response.promptFeedback.blockReason}`;
             statusCode = 400; // Bad request due to safety block
         } else if (error.message?.includes('API key not valid')) {
             errorMessage = "La clé API Google configurée n'est pas valide.";
             statusCode = 500; // Server configuration error
         } else if (error.status === 404) { // Utiliser error.status si disponible (vient de l'erreur fetch ?)
              errorMessage = `API call failed: ${error.message} (Vérifiez le nom du modèle: 'gemini-1.5-pro-latest'?)`;
              statusCode = 404;
         } else if (error.status) {
             errorMessage = `API call failed: ${error.message}`;
             statusCode = error.status;
         }
          // Renvoyer l'erreur avec la syntaxe Vercel
        return response.status(statusCode).json({ error: "Failed to generate simple outline via API.", details: errorMessage });
    }
}
