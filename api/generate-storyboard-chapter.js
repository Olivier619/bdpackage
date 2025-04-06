// api/generate-storyboard-chapter.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY;

// --- Fonction Helper pour Parser la Réponse Storyboard (basique) ---
function parseStoryboardResponse(text) {
     console.log("Attempting to parse storyboard text:\n", text.substring(0, 500) + "...");
     const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
     const panels = [];
     let currentPage = null;
     let currentPanel = null;
     let currentData = {};

     try {
          lines.forEach(line => {
               const pageMatch = line.match(/^PAGE\s+(\d+)/i);
               const panelMatch = line.match(/^(?:CASE|PANEL)\s+(\d+)/i);
               const descMatch = line.match(/^(?:DESCRIPTION|DESCRIPTION VISUELLE ENRICHIE)\s*:\s*(.*)/i);
               const shotMatch = line.match(/^(?:TYPE DE PLAN|TYPE PLAN|PLAN)\s*:\s*(.*)/i);
               const angleMatch = line.match(/^(?:ANGLE|ANGLE DE CAM[EÉ]RA)\s*:\s*(.*)/i);
               const notesMatch = line.match(/^(?:NOTES|NOTE)\s*:\s*(.*)/i);

               if (pageMatch) {
                    const newPage = parseInt(pageMatch[1], 10);
                    // Save previous panel if exists before changing page
                    if (currentPanel !== null && Object.keys(currentData).length > 0) {
                        currentData.page = currentPage === null ? (panels[panels.length-1]?.page || 1) : currentPage;
                        currentData.panel = currentPanel;
                        panels.push({...currentData}); // Push a copy
                        console.log("Saved Panel (page change):", currentData);
                    }
                    currentPage = newPage;
                    currentPanel = null;
                    currentData = {};
                    console.log("Parsing Page:", currentPage);
                    return;
               }

               if (panelMatch) {
                    const newPanel = parseInt(panelMatch[1], 10);
                     // Save previous panel if exists before starting new one
                     if (currentPanel !== null && Object.keys(currentData).length > 0) {
                         currentData.page = currentPage || (panels[panels.length-1]?.page || 1);
                         currentData.panel = currentPanel;
                         panels.push({...currentData}); // Push a copy
                         console.log("Saved Panel (panel change):", currentData);
                     }
                    currentPanel = newPanel;
                    currentData = {}; // Reset for new panel
                    console.log("Parsing Panel:", currentPanel);
                    return;
               }

               // Need a page and panel context to assign data
               if (currentPage === null || currentPanel === null) {
                   if(line.length > 0 && !line.startsWith('-')) console.warn("Ignoring line outside page/panel:", line);
                   return;
               }

               if (descMatch) currentData.description = (currentData.description ? currentData.description + "\n" : "") + descMatch[1].trim();
               else if (shotMatch) currentData.shotType = shotMatch[1].trim();
               else if (angleMatch) currentData.angle = angleMatch[1].trim();
               else if (notesMatch) currentData.notes = (currentData.notes ? currentData.notes + "\n" : "") + notesMatch[1].trim();
               else { // Append to description if no tag matches
                    if(!line.startsWith("---")) { // Avoid adding separators
                        currentData.description = (currentData.description ? currentData.description + "\n" : "") + line;
                    }
               }
          });

          // Add the very last panel
          if (currentPanel !== null && Object.keys(currentData).length > 0) {
               currentData.page = currentPage || (panels[panels.length-1]?.page || 1);
               currentData.panel = currentPanel;
               panels.push({...currentData});
               console.log("Saved Last Panel:", currentData);
          }

          console.log("Final Parsed Storyboard Panels:", panels);
          if (panels.length === 0) { throw new Error("Parsing failed: No panels parsed."); }
          return panels;

     } catch (parseError) {
          console.error("Error during storyboard parsing:", parseError);
          return { parsingError: parseError.message, rawText: text };
     }
}
// --- End Helper Function ---

export default async function handler(request, response) {
    if (!apiKey) { return response.status(500).json({ error: "API Key not configured." }); }
    if (request.method !== "POST") { return response.status(405).end('Method Not Allowed'); }

    const inputData = request.body;
    console.log("Received request data for storyboard:", inputData);
    const { keywords, genre, style, tone, details, globalTitle, chapterNumber, chapterTitle, detailedScenarioText } = inputData || {};

    if (!detailedScenarioText || chapterNumber === undefined || !style) {
        console.error("Missing fields for storyboard:", { hasDetailedScenario: !!detailedScenarioText, chapterNumber, style });
        return response.status(400).json({ error: "Missing detailed scenario, chapter number, or style." });
    }

    console.log(`--- CONSTRUCTING STORYBOARD PROMPT for Chapter ${chapterNumber} ---`);
    let prompt = `Tâche : Pour **CHAQUE Case** décrite dans le scénario détaillé du chapitre ci-dessous, génère une description visuelle enrichie pour un storyboard.\n\nCONTEXTE GÉNÉRAL DE LA BD :\n- Titre Global : ${globalTitle || 'N/A'}\n- Genre : ${genre}\n- Style Visuel Cible : ${style}\n- Ton : ${tone}\n`;
    if (details) { prompt += `- Détails Additionnels : ${details}\n`; }
    prompt += `\nSCÉNARIO DÉTAILLÉ DU CHAPITRE ${chapterNumber} ("${chapterTitle || ''}") À ANALYSER :\n\`\`\`\n${detailedScenarioText}\n\`\`\`\n\nINSTRUCTIONS POUR LE STORYBOARD (POUR CHAQUE CASE DU SCÉNARIO FOURNI) :\n1. **Langue : ÉCRIS TOUTE LA RÉPONSE EN FRANÇAIS.**\n2. **Analyse :** Lis attentivement description, dialogue, pensées.\n3. **Description Enrichie :** Écris une **DESCRIPTION VISUELLE ENRICHIE** (personnages, actions, décor, ambiance).\n4. **Suggestion Technique :** Suggère un **TYPE DE PLAN** (ex: Gros Plan, Plan Moyen, Plan d'Ensemble...). \n5. **Suggestion d'Angle :** Suggère un **ANGLE DE CAMÉRA** (ex: Normal, Plongée, Contre-plongée...). \n6. **Notes Optionnelles :** Ajoute de courtes **NOTES** si pertinent (éclairage, effet...). \n7. **Structure :** Conserve numéros PAGE et CASE.\n\nFORMAT DE SORTIE ATTENDU (Suivre pour CHAQUE case) :\n\nPAGE [Numéro]\nCASE [Numéro]\nDESCRIPTION VISUELLE ENRICHIE: [Description]\nTYPE DE PLAN: [Suggestion]\nANGLE: [Suggestion]\nNOTES: [Notes ou "Aucune"]\n\n(Répéter)\n\n**RAPPEL FINAL : Analyse le scénario fourni et génère les détails storyboard pour CHAQUE case en FRANÇAIS.**\nSTORYBOARD DÉTAILLÉ CI-DESSOUS :\n------------------------------------\n`;

    console.log(`Sending STORYBOARD prompt for Chapter ${chapterNumber} to Gemini...`);

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

        const result = await model.generateContent(prompt);
        console.log(`Received result object from Gemini (Storyboard Chap ${chapterNumber}).`);
        const geminiResponse = await result.response;
        const text = geminiResponse.text();

        console.log("--- RAW TEXT FROM GEMINI (Storyboard) ---\n" + text.substring(0, 500) + (text.length > 500 ? "..." : "") + "\n--- END RAW TEXT ---");

        const parsedStoryboard = parseStoryboardResponse(text);

        return response.status(200).json({ storyboard: parsedStoryboard });

    } catch (error) {
        console.error(`Error calling Google AI API (Storyboard Chap ${chapterNumber}):`, error);
        let errorMessage = `API call failed: ${error.message}`;
        let statusCode = 500;
         if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) {errorMessage = `Blocage Google : ${error.response.promptFeedback.blockReason}`; statusCode = 400;}
         else if (error.message?.includes('API key not valid')) {errorMessage = "Clé API invalide."; statusCode = 500;}
         else if (error.status === 404) {errorMessage = `Modèle non trouvé: ${error.message}`; statusCode = 404;}
         else if (error.status) {errorMessage = `Erreur API: ${error.message}`; statusCode = error.status;}
        return response.status(statusCode).json({ error: `Échec génération storyboard chap. ${chapterNumber}.`, details: errorMessage });
    }
}
