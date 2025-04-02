// Use an IIFE to encapsulate the code
(function() {
    let pipelineInstance = null;
    let isPipelineLoading = false;
    const modelName = 'Felladrin/onnx-bloomz-560m-sft-chat';

    // --- Initialize Pipeline (Keep existing getPipeline function) ---
    async function getPipeline() {
        if (pipelineInstance) {
            return pipelineInstance;
        }
        if (isPipelineLoading) {
            await new Promise(resolve => setTimeout(resolve, 100));
            return getPipeline();
        }

        isPipelineLoading = true;
        console.log("Loading text generation pipeline...");
        try {
            const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.0');
            pipelineInstance = await pipeline('text-generation', modelName, {
                progress_callback: (progress) => {
                    console.log("Model loading progress:", progress);
                }
            });
            console.log("Pipeline loaded successfully.");
            return pipelineInstance;
        } catch (error) {
            console.error("Failed to load pipeline:", error);
            throw new Error(`Failed to load AI model: ${error.message}`);
        } finally {
            isPipelineLoading = false;
        }
    }


    // --- Core Generation Functions ---

    /**
     * Generates the main scenario based on user inputs.
     * Aims for a structured output IN FRENCH.
     */
async function generateStory(keywords, genre, style, tone, details) {
    console.log("Starting SIMPLIFIED story generation test...");
    const generator = await getPipeline();

    // --- Prompt TRÈS SIMPLIFIÉ ---
    let prompt = `Écris une courte histoire (environ 200 mots) en FRANÇAIS sur le sujet suivant : "${keywords}".\n`;
    prompt += `Genre : ${genre}. Ton : ${tone}.\n`;
    prompt += `La réponse doit être uniquement en FRANÇAIS.\n\n`;
    prompt += `HISTOIRE CI-DESSOUS :\n`;
    prompt += `---------------------\n`;

    console.log("Sending SIMPLIFIED prompt to AI:\n", prompt);

    try {
        const result = await generator(prompt, {
            max_new_tokens: 300, // Réduit pour une histoire courte
            temperature: 0.8,
            top_p: 0.9,
            repetition_penalty: 1.1
        });

        const generatedText = result[0].generated_text.substring(prompt.length).trim();
        console.log("SIMPLIFIED Raw AI Response:", generatedText);

        // --- Retourner la structure la plus basique possible ---
        // Pas de parsing complexe ici, juste pour voir si on a du texte français
        if (generatedText && generatedText.length > 20) {
             return {
                  title: "Test Histoire Simple",
                  synopsis: "N/A",
                  chapters: [{
                      chapterNumber: 1,
                      title: "Texte Brut Généré",
                      pages: [],
                      rawContent: generatedText // Mettre le texte brut ici
                  }]
             };
        } else {
            // Si même ça échoue ou retourne du vide/n'importe quoi
             return {
                 title: "Test Échoué",
                 synopsis: "N/A",
                 chapters: [{
                     chapterNumber: 1,
                     title: "L'IA n'a pas répondu correctement",
                     pages: [],
                     rawContent: generatedText || "Aucune réponse de l'IA."
                 }]
             };
        }

    } catch (error) {
        console.error('Erreur lors de la génération simple:', error);
        throw new Error(`AI Simple Generation Failed: ${error.message}`);
    }
}

    /**
     * Improved text parser using a line-by-line approach.
     */
     function parseScenarioTextImproved(text) {
         console.log("Attempting improved parsing...");
         const scenario = {
             title: "Titre Non Défini",
             synopsis: "",
             chapters: []
         };
         let currentChapter = null;
         let currentPage = null;
         let currentPanel = null;
         let readingSynopsis = false;

         const lines = text.split('\n'); //.map(line => line.trim()); //.filter(line => line.length > 0);

         for (const rawLine of lines) {
             const line = rawLine.trim();
             if (line.length === 0) continue; // Skip empty lines

             // Title (Case-insensitive)
             if (line.toUpperCase().startsWith("TITRE :")) {
                 scenario.title = line.substring(7).trim();
                 readingSynopsis = false; // Stop reading synopsis if title is found later
                 console.log("Parsed Title:", scenario.title);
                 continue;
             }

             // Synopsis Start (Case-insensitive)
             if (line.toUpperCase().startsWith("SYNOPSIS :")) {
                 scenario.synopsis = line.substring(10).trim();
                 readingSynopsis = true;
                 console.log("Parsed Synopsis Start:", scenario.synopsis);
                 continue;
             }

             // Chapter (Case-insensitive)
             const chapterMatch = line.match(/CHAPITRE\s+(\d+)\s*:\s*(.*)/i);
             if (chapterMatch) {
                 currentChapter = {
                     chapterNumber: parseInt(chapterMatch[1]),
                     title: chapterMatch[2].trim(),
                     pages: []
                 };
                 scenario.chapters.push(currentChapter);
                 currentPage = null;
                 currentPanel = null;
                 readingSynopsis = false; // Stop reading synopsis if a chapter starts
                 console.log("Parsed Chapter:", currentChapter.title);
                 continue;
             }

             // If we are potentially reading multi-line synopsis
             if (readingSynopsis) {
                 scenario.synopsis += "\n" + line; // Append line to synopsis
                 continue;
             }

             // Must be inside a chapter to parse pages/panels
             if (!currentChapter) continue;

             // Page (Case-insensitive)
             const pageMatch = line.match(/PAGE\s+(\d+)\s*:/i);
             if (pageMatch) {
                 currentPage = {
                     pageNumber: parseInt(pageMatch[1]),
                     panels: []
                 };
                 currentChapter.pages.push(currentPage);
                 currentPanel = null;
                 console.log("Parsed Page:", currentPage.pageNumber);
                 continue;
             }

             // Must be inside a page to parse panels
             if (!currentPage) continue;

             // Panel / Case (Case-insensitive)
             const panelMatchSimple = line.match(/Case\s+(\d+)\s*:\s*(.*)/i);
             if (panelMatchSimple) {
                 const panelText = panelMatchSimple[2].trim();
                 // Try to extract Dialogue/Thoughts from the panelText
                 let description = panelText;
                 let dialogue = null;
                 let thoughts = null;

                 const dialogueMatch = panelText.match(/Dialogue:\s*"([^"]*)"/i);
                 if (dialogueMatch) {
                     dialogue = dialogueMatch[1];
                     description = description.replace(dialogueMatch[0], '').trim(); // Remove dialogue part
                 }

                 const thoughtsMatch = panelText.match(/Pensées:\s*\(\s*([^)]*)\s*\)/i);
                  if (thoughtsMatch) {
                      thoughts = thoughtsMatch[1];
                      description = description.replace(thoughtsMatch[0], '').trim(); // Remove thoughts part
                  }


                 currentPanel = {
                     panelNumber: parseInt(panelMatchSimple[1]),
                     description: description.trim(),
                     dialogue: dialogue,
                     thoughts: thoughts
                 };
                 currentPage.panels.push(currentPanel);
                 // console.log("Parsed Panel:", currentPanel.panelNumber); // Log less verbosely
                 continue;
             }

             // If the line doesn't match a new structure element,
             // append it to the description of the last panel (if one exists)
             if (currentPanel) {
                  // Append non-structural lines to the description of the current panel
                  // Avoid appending short/junk lines
                  if (line.length > 5) {
                       currentPanel.description += "\n" + line;
                  }
             } else if (currentPage && line.length > 5) {
                 // Or maybe it's context for the page before the first panel? Less likely.
                 // console.log("Orphan line on page:", line);
             }
         }
         console.log("Parsing finished.");
         return scenario;
     }


    /**
     * Generates storyboard suggestions (framing, composition) for a given chapter's panels.
     * Input should be FRENCH, Output description should be FRENCH.
     */
    async function generateStoryboardChapter(chapterPanelData, style, tone) {
        console.log("Generating storyboard suggestions for chapter...");
        const generator = await getPipeline();
        const storyboardResults = [];

         for (const panel of chapterPanelData) {
             const panelDesc = panel.description || "Scène sans description";

             // Prompt requesting FRENCH output for suggestions
             let prompt = `Tâche : Suggérer des éléments de storyboard pour une case de BD. **Réponds en FRANÇAIS.**\n\n`;
             prompt += `CONTEXTE (en Français) :\n`;
             prompt += `- Style Visuel Global : ${style}\n`;
             prompt += `- Ton Général : ${tone}\n`;
             prompt += `- Description du Scénario pour cette Case : ${panelDesc}\n`;
             if (panel.dialogue) prompt += `- Dialogue : "${panel.dialogue}"\n`;
             if (panel.thoughts) prompt += `- Pensées : (${panel.thoughts})\n`;
             prompt += `\nINSTRUCTIONS (en Français) :\n`;
             prompt += `1. Suggère UN type de Cadrage (ex: Gros plan, Plan américain, Plan moyen, Plan large, Vue plongeante, Contre-plongée, Plan d'ensemble).\n`;
             prompt += `2. Décris brièvement la Composition clé de l'image (ex: Personnage centré, Règle des tiers, Lignes directrices vers le sujet, Espace négatif important).\n`;
             prompt += `3. Sois concis.\n\n`;
             prompt += `FORMAT DE SORTIE ATTENDU (une seule ligne, en Français) :\n`;
             prompt += `Cadrage: [Type de Cadrage] / Composition: [Description Composition]\n\n`;
             prompt += `**RAPPEL : Réponse en FRANÇAIS.**\n`;
             prompt += `SUGGESTION CI-DESSOUS :\n`;
             prompt += `-----------------------\n`;


             try {
                 const result = await generator(prompt, {
                     max_new_tokens: 60, // Allow slightly more space
                     temperature: 0.6,
                     repetition_penalty: 1.1,
                     // do_sample: true
                 });
                 const suggestionText = result[0].generated_text.substring(prompt.length).trim();

                 // Parse the suggestion (assuming French keywords if successful)
                 const cadrageMatch = suggestionText.match(/(?:Cadrage|Framing):\s*([^/]+)/i); // Allow English keyword just in case
                 const compositionMatch = suggestionText.match(/Composition:\s*(.*)/i);

                 storyboardResults.push({
                     pageNumber: panel.pageNumber,
                     panelNumber: panel.panelNumber,
                     scenarioDesc: panelDesc, // Keep original french desc
                     framing: cadrageMatch ? cadrageMatch[1].trim() : "Non suggéré",
                     composition: compositionMatch ? compositionMatch[1].trim() : "Non suggérée"
                 });
                  await new Promise(resolve => setTimeout(resolve, 50)); // Shorter delay maybe okay

             } catch (error) {
                  console.error(`Error generating storyboard suggestion for panel ${panel.panelNumber}:`, error);
                  storyboardResults.push({
                      pageNumber: panel.pageNumber,
                      panelNumber: panel.panelNumber,
                      scenarioDesc: panelDesc,
                      framing: "Erreur IA",
                      composition: "Erreur IA"
                  });
             }
         }
         console.log("Storyboard suggestions generated:", storyboardResults);
         return storyboardResults;
    }


    /**
     * Generates Midjourney prompts for a given chapter's storyboard panels.
     * Input description is FRENCH, Output prompt MUST be ENGLISH.
     */
    async function generatePromptsForChapter(storyboardChapterData, style, tone) {
        console.log("Generating Midjourney prompts for chapter...");
        const generator = await getPipeline();
        const promptResults = [];

        const styleKeywords = getStyleKeywords(style); // English keywords
        const toneKeywords = getToneKeywords(tone);   // English keywords

        for (const panel of storyboardChapterData) {
             const baseDescFR = panel.scenarioDesc || "panneau de bande dessinée"; // French description
             const framing = panel.framing || "medium shot"; // Can be French, AI should understand context
             const composition = panel.composition || ""; // Can be French

             // Prompt asking specifically for ENGLISH output
             let prompt = `Tâche : Générer un prompt optimisé pour Midjourney v6 en **ANGLAIS** pour une case de bande dessinée.\n\n`;
             prompt += `CONTEXTE DE LA CASE (Partiellement en Français) :\n`;
             prompt += `- Description Scénario (FR) : ${baseDescFR}\n`;
             prompt += `- Cadrage Suggéré (FR/Concept) : ${framing}\n`;
             prompt += `- Composition Suggérée (FR/Concept) : ${composition}\n`;
             prompt += `- Style Visuel Global (Concept) : ${style} (Keywords EN: ${styleKeywords})\n`;
             prompt += `- Ton Général (Concept) : ${tone} (Keywords EN: ${toneKeywords})\n`;
             prompt += `\nINSTRUCTIONS :\n`;
             prompt += `1. **TRADUIS et ADAPTE** le contexte (description, cadrage, composition) en un prompt créatif et efficace en **ANGLAIS** pour Midjourney.\n`;
             prompt += `2. Utilise des mots-clés descriptifs et évocateurs en **ANGLAIS**.\n`;
             prompt += `3. Intègre les mots-clés de style **ANGLAIS** : ${styleKeywords}.\n`;
             prompt += `4. Intègre des mots-clés de ton/ambiance **ANGLAIS** : ${toneKeywords}.\n`;
             prompt += `5. Ajoute des termes qualitatifs **ANGLAIS** comme "detailed illustration", "cinematic", "high quality", "masterpiece".\n`;
             prompt += `6. Formate le prompt commençant par '/imagine prompt:'.\n`;
             prompt += `7. Ajoute les paramètres '--ar 3:2 --v 6' à la fin.\n`;
             prompt += `8. **Le prompt final doit être UNIQUEMENT en ANGLAIS.**\n\n`;
             prompt += `FORMAT DE SORTIE ATTENDU (une seule ligne en ANGLAIS) :\n`;
             prompt += `/imagine prompt: [Midjourney prompt in English here] --ar 3:2 --v 6\n\n`;
             prompt += `**RAPPEL : Sors UNIQUEMENT le prompt Midjourney en ANGLAIS.**\n`;
             prompt += `PROMPT MIDJOURNEY (ANGLAIS) CI-DESSOUS :\n`;
             prompt += `--------------------------------------\n`;


             try {
                 const result = await generator(prompt, {
                     max_new_tokens: 180, // Allow ample space for English prompt
                     temperature: 0.7,
                     repetition_penalty: 1.1,
                     // do_sample: true
                 });
                 let mjPrompt = result[0].generated_text.substring(prompt.length).trim();

                 // Cleanup
                 if (mjPrompt.includes("PROMPT MIDJOURNEY (ANGLAIS) CI-DESSOUS :")) {
                     mjPrompt = mjPrompt.split("PROMPT MIDJOURNEY (ANGLAIS) CI-DESSOUS :")[1]?.trim() ?? mjPrompt;
                 }
                  if (mjPrompt.includes("--------------------------------------")) {
                      mjPrompt = mjPrompt.split("--------------------------------------")[1]?.trim() ?? mjPrompt;
                  }
                 if (!mjPrompt.toLowerCase().startsWith('/imagine prompt:')) {
                     // Check if it contains it somewhere else (model might add preamble)
                     const imagineIndex = mjPrompt.toLowerCase().indexOf('/imagine prompt:');
                     if (imagineIndex !== -1) {
                         mjPrompt = mjPrompt.substring(imagineIndex);
                     } else {
                         mjPrompt = `/imagine prompt: ${mjPrompt}`; // Prepend if missing entirely
                     }
                 }
                 // Ensure parameters (might be duplicated, but better safe)
                 if (!mjPrompt.includes('--ar')) {
                     mjPrompt += ' --ar 3:2';
                 }
                 if (!mjPrompt.includes('--v')) {
                     mjPrompt += ' --v 6';
                 }

                 promptResults.push({
                     pageNumber: panel.pageNumber,
                     panelNumber: panel.panelNumber,
                     description: baseDescFR, // Keep French description for reference
                     prompt: mjPrompt // Store the cleaned English prompt
                 });
                  await new Promise(resolve => setTimeout(resolve, 50));

             } catch (error) {
                  console.error(`Error generating Midjourney prompt for panel ${panel.panelNumber}:`, error);
                  promptResults.push({
                      pageNumber: panel.pageNumber,
                      panelNumber: panel.panelNumber,
                      description: baseDescFR,
                      prompt: `/imagine prompt: Error generating prompt for context: ${baseDescFR.substring(0,50)}..., ${framing}, ${styleKeywords} --ar 3:2 --v 6`
                  });
             }
        }
        console.log("Midjourney prompts generated:", promptResults);
        return promptResults;
    }

    // --- Helper Functions (Keep existing getStyleKeywords, getToneKeywords) ---
     function getStyleKeywords(style) { /* ... same as before ... */
        const mapping = {
             "Manga": "manga style, anime art, detailed line art, dynamic panels, screen tones",
             "Franco-Belge": "franco-belgian comic style, ligne claire, clear line art, Herge Tintin style, flat colors",
             "Comics US": "american comic book style, superhero art, dynamic action poses, bold colors, ink outlines, Jack Kirby style",
             "Réaliste": "realistic digital painting, detailed illustration, cinematic lighting, volumetric light, photorealistic",
             "Cartoon": "cartoon style, animation cel, fun characters, simple background, exaggerated features",
             "Aquarelle": "watercolor illustration style, soft edges, vibrant washes, wet-on-wet technique, textured paper",
         };
         return mapping[style] || style;
     }
     function getToneKeywords(tone) { /* ... same as before ... */
          const mapping = {
             "Épique": "epic scale, dramatic lighting, heroic poses, vast landscape, cinematic composition, god rays",
             "Sérieux": "serious mood, realistic expressions, grounded setting, muted colors, subtle emotion",
             "Léger / Humoristique": "lighthearted, funny expressions, bright colors, comedic timing, cheerful, playful",
             "Sombre / Mature": "dark atmosphere, gritty texture, noir lighting, intense emotion, shadow, moody, grim",
             "Mystérieux": "mysterious fog, hidden details, suspenseful composition, silhouette, enigmatic, ambient occlusion",
             "Poétique": "poetic atmosphere, soft focus, symbolic imagery, ethereal light, dreamy, pastel colors",
          };
          return mapping[tone] || tone;
     }

    // --- Modification/Regeneration Placeholders (Keep existing placeholders) ---
     async function modifyScenario(currentScenarioData, modificationRequest, genre, style, tone) { /* ... */ }
     async function modifyStoryboardChapter(currentStoryboardData, modificationRequest, style, tone) { /* ... */ }

    // Expose functions to the global scope
    window.generateStory = generateStory;
    window.generateStoryboardChapter = generateStoryboardChapter;
    window.generatePromptsForChapter = generatePromptsForChapter;
    window.modifyScenario = modifyScenario;
    window.modifyStoryboardChapter = modifyStoryboardChapter;

})();
