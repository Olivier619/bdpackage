// api/generate-prompts-chapter.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY;

// --- Fonction Helper pour Parser la Réponse des Prompts (MISE À JOUR) ---
function parsePromptsResponse(text) {
    console.log("Attempting to parse prompts text (Page/Panel):\n", text.substring(0, 500) + "...");
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const prompts = [];
    let currentPage = null; // Ajouté
    let currentPanel = null;
    let currentPrompt = ""; // Pour gérer les prompts sur plusieurs lignes

    try {
        lines.forEach(line => {
            // Nouveau Regex pour capturer PAGE X - CASE Y
            const promptMatch = line.match(/^(?:PAGE)\s+(\d+)\s+-\s+(?:CASE|PANEL)\s+(\d+)\s+PROMPT\s*:\s*(.*)/i);

            if (promptMatch) {
                // Sauvegarder le prompt précédent s'il existe
                if (currentPage !== null && currentPanel !== null && currentPrompt.length > 0) {
                    prompts.push({ page: currentPage, panel: currentPanel, prompt: currentPrompt.trim() });
                    console.log(`Saved Prompt for Page ${currentPage} - Panel ${currentPanel}`);
                }

                // Extraire les nouvelles informations
                currentPage = parseInt(promptMatch[1], 10);
                currentPanel = parseInt(promptMatch[2], 10);
                currentPrompt = promptMatch[3].trim(); // Commence un nouveau prompt

                console.log(`Parsing Prompt Start for Page ${currentPage} - Panel ${currentPanel}: ${currentPrompt.substring(0, 60)}...`);

            } else if (currentPage !== null && currentPanel !== null && !line.match(/^(?:PAGE)\s+(\d+)\s+-\s+(?:CASE|PANEL)/i) && line.length > 5 && !line.startsWith('-') && !line.startsWith('==')) {
                 // Append to the current prompt if it's a continuation line
                 currentPrompt += "\n" + line;
                 console.log(`Appended to Prompt for Page ${currentPage} - Panel ${currentPanel}: ${line.substring(0,60)}...`);
            } else {
                 if (!line.startsWith('---') && !line.startsWith('==') && !line.toLowerCase().includes('below') && !line.toLowerCase().includes('english')) {
                    console.warn("Ignoring line during prompt parsing (Page/Panel):", line);
                 }
            }
        });

        // Sauvegarder le tout dernier prompt après la boucle
        if (currentPage !== null && currentPanel !== null && currentPrompt.length > 0) {
            prompts.push({ page: currentPage, panel: currentPanel, prompt: currentPrompt.trim() });
            console.log(`Saved Last Prompt for Page ${currentPage} - Panel ${currentPanel}`);
        }


        // Trier par page puis par case
        prompts.sort((a, b) => {
             if (a.page !== b.page) { return a.page - b.page; }
             return a.panel - b.panel;
         });

        console.log("Final Parsed Prompts (Page/Panel):", prompts);
        if (prompts.length === 0 && text.length > 10) {
             throw new Error("Parsing failed: No prompts parsed matching the expected format (PAGE X - CASE Y PROMPT: ...).");
         }
        // Retourne array: [{ page: 1, panel: 1, prompt: "..." }, { page: 1, panel: 2, prompt: "..."}, ...]
        return prompts;

    } catch (parseError) {
        console.error("Error during prompts parsing (Page/Panel):", parseError);
        return { parsingError: parseError.message, rawText: text };
    }
}
// --- End Helper Function ---


export default async function handler(request, response) {
    if (!apiKey) { console.error("API Key missing"); return response.status(500).json({ error: "API Key not configured." }); }
    if (request.method !== "POST") { response.setHeader('Allow', ['POST']); return response.status(405).end('Method Not Allowed'); }

    const inputData = request.body;
    console.log("Received request data for prompt generation:", inputData);
    const { style, genre, tone, globalTitle, chapterNumber, chapterTitle, storyboardDataForChapter } = inputData || {};

    if (!style || !storyboardDataForChapter || !Array.isArray(storyboardDataForChapter) || storyboardDataForChapter.length === 0) {
        console.error("Missing style or valid storyboard data for prompt generation:", { style, hasStoryboard: !!storyboardDataForChapter });
        return response.status(400).json({ error: "Missing required style or storyboard data for prompt generation." });
    }

    console.log(`--- CONSTRUCTING PROMPTS PROMPT for Chapter ${chapterNumber} (Page/Panel) ---`);

    // Préparer le contexte du storyboard en incluant PAGE et CASE (MISE À JOUR)
    let storyboardContext = "";
    let currentPageContext = -1;
    storyboardDataForChapter.forEach(panel => {
        if (panel.page !== currentPageContext) {
            if (currentPageContext !== -1) { storyboardContext += "\n"; } // Add newline between pages
            storyboardContext += `PAGE ${panel.page}\n------\n`;
            currentPageContext = panel.page;
        }
        storyboardContext += `CASE ${panel.panel}:\n- Description: ${panel.description || 'N/A'}\n- Shot Type: ${panel.shotType || 'N/A'}\n- Angle: ${panel.angle || 'N/A'}\n- Notes: ${panel.notes || 'None'}\n\n`;
    });


    // Prompt pour Gemini (MISE À JOUR format de sortie)
    let prompt = `TASK: Generate image generation prompts in **ENGLISH**, optimized for Midjourney, for EACH panel described below.

GENERAL COMIC CONTEXT:
- Visual Style: ${style}
- Genre: ${genre || 'N/A'}
- Tone: ${tone || 'N/A'}
- Global Title (for info): ${globalTitle || 'N/A'}
- Chapter ${chapterNumber || 'N/A'}: ${chapterTitle || 'N/A'}

STORYBOARD PANELS FOR THIS CHAPTER TO ANALYZE:
\`\`\`
${storyboardContext}
\`\`\`

INSTRUCTIONS FOR PROMPT GENERATION (FOR EACH PANEL):
1.  **Language: ENGLISH ONLY.** Generate the prompts themselves strictly in English.
2.  **Focus: Generate ONE prompt PER panel** based on its specific data (description, shot, angle, notes).
3.  **Identify Correct Panel:** Use the correct description and technical details corresponding to the PAGE and CASE number.
4.  **Incorporate Camera:** Translate "Shot Type" and "Angle" into descriptive English terms (e.g., "close-up shot", "low angle view", "wide angle establishing shot", "dynamic action shot", "eye-level shot").
5.  **Style Integration:** The prompt MUST strongly reflect the target **Visual Style: ${style}**. Include keywords related to this style (e.g., "manga style", "bande dessinee art style", "american comic book art", "digital painting", "cinematic lighting").
6.  **Keywords:** Use descriptive English keywords (nouns, adjectives) for scene, characters, actions, objects, mood, lighting, and setting.
7.  **Image Generation Prompt Optimization:**
    *   Keep prompts relatively concise but evocative. Aim for clarity.
    *   Structure suggestion: [Subject/Characters], [Action/Pose], [Setting/Background Details], [Mood/Atmosphere], [Style Keywords], [Camera Shot/Angle].
    *   **DO NOT include technical parameters like \`--v\` or \`--ar\` at the end of the prompt.**
    *   Focus solely on the descriptive text for the image.
8.  **Clarity:** Ensure the prompt clearly conveys the visual essence of the panel.

OUTPUT FORMAT (Strictly follow this for EACH panel, including Page and Case numbers):

PAGE [Page Number] - CASE [Panel Number] PROMPT: [Generated English prompt for this specific panel.]

(Repeat for all panels provided, maintaining the correct Page and Case numbers)

**FINAL REMINDER: Generate ONLY the English prompts in the specified format (PAGE X - CASE Y PROMPT: ...) based on the provided storyboard panels and the visual style "${style}". DO NOT add --v 6.0.**
PROMPTS BELOW:
------------------------------------
`;

    console.log(`Sending PROMPTS prompt for Chapter ${chapterNumber} to Gemini...`);

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

        const result = await model.generateContent(prompt);
        console.log(`Received result object from Gemini (Prompts Chap ${chapterNumber}).`);
        const geminiResponse = await result.response;
        const text = geminiResponse.text();

        console.log("--- RAW TEXT FROM GEMINI (Prompts) ---\n" + text.substring(0, 500) + (text.length > 500 ? "..." : "") + "\n--- END RAW TEXT ---");

        const parsedPrompts = parsePromptsResponse(text); // Utilise le parser mis à jour

        if (parsedPrompts.parsingError) {
             console.warn(`Prompt parsing failed for chapter ${chapterNumber}.`);
             return response.status(200).json({ prompts: parsedPrompts });
         } else {
             console.log(`Prompts parsed successfully for chapter ${chapterNumber}. Count: ${parsedPrompts.length}`);
             // Renvoie [{ page: 1, panel: 1, prompt: "..." }, ...]
             return response.status(200).json({ prompts: parsedPrompts });
         }

    } catch (error) {
        console.error(`Error calling Google AI API (Prompts Chap ${chapterNumber}):`, error);
        let errorMessage = `API call failed: ${error.message}`; let statusCode = 500;
         if (error.response?.promptFeedback?.blockReason) {errorMessage = `Blocage Google : ${error.response.promptFeedback.blockReason}`; statusCode = 400;}
         else if (error.message?.includes('API key not valid')) {errorMessage = "Clé API invalide."; statusCode = 500;}
         else if (error.status === 404) {errorMessage = `Modèle non trouvé: ${error.message}`; statusCode = 404;}
         else if (error.status) {errorMessage = `Erreur API: ${error.message}`; statusCode = error.status;}
        return response.status(statusCode).json({ error: `Échec génération prompts chap. ${chapterNumber}.`, details: errorMessage });
    }
}
