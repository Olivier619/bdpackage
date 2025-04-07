// api/generate-prompts-chapter.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY;

// --- Fonction Helper pour Parser la Réponse des Prompts ---
function parsePromptsResponse(text) {
    console.log("Attempting to parse prompts text:\n", text.substring(0, 500) + "...");
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const prompts = [];
    let currentPanel = null;

    try {
        lines.forEach(line => {
            const promptMatch = line.match(/^(?:PANEL|CASE)\s+(\d+)\s+PROMPT\s*:\s*(.*)/i);

            if (promptMatch) {
                currentPanel = parseInt(promptMatch[1], 10);
                const promptText = promptMatch[2].trim();
                if (currentPanel && promptText) {
                    prompts.push({ panel: currentPanel, prompt: promptText });
                    console.log(`Parsed Prompt for Panel ${currentPanel}: ${promptText.substring(0, 60)}...`);
                }
            } else if (currentPanel !== null && prompts.length > 0 && !line.match(/^(?:PANEL|CASE)\s+(\d+)/i) && line.length > 5 && !line.startsWith('-') && !line.startsWith('==')) {
                 // Append to the previous prompt if it's a continuation line (heuristic)
                 prompts[prompts.length - 1].prompt += "\n" + line;
                 console.log(`Appended to Prompt for Panel ${currentPanel}: ${line.substring(0,60)}...`);
            } else {
                 if (!line.startsWith('---') && !line.startsWith('==') && !line.toLowerCase().includes('below') && !line.toLowerCase().includes('english')) {
                    console.warn("Ignoring line during prompt parsing:", line);
                 }
            }
        });

        prompts.sort((a, b) => a.panel - b.panel); // Ensure order
        console.log("Final Parsed Prompts:", prompts);
        if (prompts.length === 0 && text.length > 10) { // Check text length to avoid error on empty valid response
             throw new Error("Parsing failed: No prompts parsed matching the expected format.");
         }
        return prompts; // Returns array: [{ panel: 1, prompt: "..." }, ...]

    } catch (parseError) {
        console.error("Error during prompts parsing:", parseError);
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

    console.log(`--- CONSTRUCTING PROMPTS PROMPT for Chapter ${chapterNumber} ---`);

    // Prepare storyboard text for the prompt
    let storyboardContext = storyboardDataForChapter.map(panel => {
        return `PANEL ${panel.panel}:\n- Description: ${panel.description || 'N/A'}\n- Shot Type: ${panel.shotType || 'N/A'}\n- Angle: ${panel.angle || 'N/A'}\n- Notes: ${panel.notes || 'None'}`;
    }).join('\n\n');


    let prompt = `TASK: Generate image generation prompts in **ENGLISH**, optimized for Midjourney v6, for EACH panel described below.

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
2.  **Focus: Generate ONE prompt PER panel** based on its specific data.
3.  **Content Source:** Primarily use the panel's "Description".
4.  **Incorporate Camera:** Translate "Shot Type" and "Angle" into descriptive English terms suitable for image generation (e.g., "close-up shot", "low angle view", "wide angle establishing shot", "dynamic action shot", "eye-level shot").
5.  **Style Integration:** The prompt MUST strongly reflect the target **Visual Style: ${style}**. Include keywords related to this style (e.g., "manga style", "bande dessinee art style", "american comic book art", "digital painting", "cinematic lighting").
6.  **Keywords:** Use descriptive English keywords (nouns, adjectives) for scene, characters, actions, objects, mood, lighting, and setting.
7.  **Midjourney v6 Optimization:**
    *   Keep prompts relatively concise but evocative. Aim for clarity.
    *   Structure suggestion: [Subject/Characters], [Action/Pose], [Setting/Background Details], [Mood/Atmosphere], [Style Keywords], [Camera Shot/Angle].
    *   **Include \`--v 6.0\` at the end of each prompt.**
    *   (Optional: you can suggest aspect ratio like \`--ar 2:3\` or \`--ar 3:4\` if it seems appropriate for comic panels, but start without forcing it).
8.  **Clarity:** Ensure the prompt clearly conveys the visual essence of the panel.

OUTPUT FORMAT (Strictly follow this for EACH panel):

PANEL [Panel Number] PROMPT: [Generated English prompt for this panel, ending with --v 6.0]

(Repeat for all panels provided)

**FINAL REMINDER: Generate ONLY the English prompts in the specified format (PANEL X PROMPT: ... --v 6.0) based on the provided storyboard panels and the visual style "${style}".**
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

        const parsedPrompts = parsePromptsResponse(text); // Returns array or { parsingError, rawText }

        if (parsedPrompts.parsingError) {
             console.warn(`Prompt parsing failed for chapter ${chapterNumber}.`);
             // Send back the error structure
             return response.status(200).json({ prompts: parsedPrompts }); // Send error within success response
         } else {
             console.log(`Prompts parsed successfully for chapter ${chapterNumber}. Count: ${parsedPrompts.length}`);
             return response.status(200).json({ prompts: parsedPrompts }); // Send array: [{panel: 1, prompt: "..."}, ...]
         }

    } catch (error) {
        console.error(`Error calling Google AI API (Prompts Chap ${chapterNumber}):`, error);
        let errorMessage = `API call failed: ${error.message}`;
        let statusCode = 500;
         if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) {errorMessage = `Blocage Google : ${error.response.promptFeedback.blockReason}`; statusCode = 400;}
         else if (error.message?.includes('API key not valid')) {errorMessage = "Clé API invalide."; statusCode = 500;}
         else if (error.status === 404) {errorMessage = `Modèle non trouvé: ${error.message}`; statusCode = 404;}
         else if (error.status) {errorMessage = `Erreur API: ${error.message}`; statusCode = error.status;}
        return response.status(statusCode).json({ error: `Échec génération prompts chap. ${chapterNumber}.`, details: errorMessage });
    }
}
