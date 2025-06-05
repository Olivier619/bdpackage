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
    const { style, genre, tone, details, globalTitle, chapterNumber, chapterTitle, storyboardDataForChapter } = inputData || {};

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


    // api/generate-prompts-chapter.js

// ... (Imports, parsePromptsResponse, début handler, extraction data, storyboardContext) ...

    // api/generate-prompts-chapter.js

// ... (Imports, parsePromptsResponse, début handler, extraction data (avec 'details'), storyboardContext) ...

    // Prompt pour Gemini (MISE À JOUR Cohérence + Noms - Tentative Renforcée)
    let prompt = `TASK: Generate image generation prompts in **ENGLISH**, optimized for Midjourney, for EACH panel described below. Adhere strictly to character and setting consistency throughout this response.

CONTEXT:
- Visual Style: ${style}
- Genre: ${genre || 'N/A'}
- Tone: ${tone || 'N/A'}
- Chapter ${chapterNumber || 'N/A'}: ${chapterTitle || 'N/A'}

**CHARACTER/SETTING REFERENCE DETAILS (Use these FIRST):**
\`\`\`
${details || 'No specific character or setting details were provided by the user.'}
\`\`\`

STORYBOARD PANELS FOR THIS CHAPTER:
\`\`\`
${storyboardContext}
\`\`\`

**CRITICAL INSTRUCTIONS FOR CONSISTENCY AND PROMPT GENERATION:**

1.  **Parse Storyboard:** For each PAGE and CASE in the storyboard: identify the description, shot type, angle, and any characters present.
2.  **Consistency Check (Apply to EACH prompt generated):**
    *   **User Details First:** If a character/setting from the "REFERENCE DETAILS" is present in the current panel, **you MUST use the EXACT description** provided in the reference details for that character/setting in your generated prompt.
    *   **Internal Memory (New Elements):** If a new character/setting (NOT in reference details) appears for the first time in a panel, describe it based on the panel description. **Remember this description.** For ALL subsequent panels in THIS response where that SAME new character/setting appears, **you MUST reuse the description you established initially.** DO NOT change their appearance later.
    *   **Character Naming:** You MUST include the names of known characters if they are present in the panel description.
3.  **Prompt Content:** Generate ONE English prompt per panel, primarily using the panel's "Description", incorporating the camera details (Shot Type/Angle translated to English terms), and reflecting the "Visual Style: ${style}".
4.  **Prompt Structure:** Suggested structure: [Subject/Characters (with CONSISTENT description)], [Action/Pose], [Setting/Background Details], [Mood/Atmosphere], [Style Keywords], [Camera Shot/Angle].
5.  **Exclusions:** **DO NOT include technical parameters** like \`--v\` or \`--ar\`.

**OUTPUT FORMAT (Strictly follow for EACH panel):**

PAGE [Page Number] - CASE [Panel Number] PROMPT: [Generated English prompt adhering to ALL consistency and content instructions above.]

(Repeat for all panels, ensuring consistency is maintained throughout the entire list of prompts)

**FINAL CHECK: Before outputting, verify that for every prompt, character/setting descriptions match either the USER-PROVIDED DETAILS or the description you established for them upon their first appearance in this specific response. Ensure names are included.**
PROMPTS BELOW:
------------------------------------
`;

    console.log(`Sending PROMPTS prompt for Chapter ${chapterNumber} to Gemini...`);

    try {
        // ... (Reste du code try/catch/finally INCHANGÉ) ...
        // ... (Appel Gemini, parsing, renvoi de la réponse) ...

    } catch (error) {
        // ... (Gestion des erreurs INCHANGÉE) ...
    }

    // ... (Reste du code try/catch/finally INCHANGÉ) ...

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
