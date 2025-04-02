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
        console.log("Starting scenario generation...");
        const generator = await getPipeline();

        // --- Construct Detailed Prompt for Scenario Structure ---
        // Added explicit French language enforcement
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
        prompt += `4. Divise l'histoire en 3 à 5 chapitres logiques. Donne un titre à chaque chapitre en FRANÇAIS.\n`;
        prompt += `5. Pour CHAQUE chapitre, détaille le contenu page par page (vise 5-8 pages par chapitre) en FRANÇAIS.\n`;
        prompt += `6. Pour CHAQUE page, décris le contenu de 3 à 6 cases (panels) en FRANÇAIS.\n`;
        prompt += `7. Pour CHAQUE case, fournis IMPÉRATIVEMENT en FRANÇAIS :\n`;
        prompt += `   - Description visuelle concise (ce qu'on voit : décor, action, personnages).\n`;
        prompt += `   - Dialogue (si présent, entre guillemets).\n`;
        prompt += `   - Pensées (si présentes, entre parenthèses et en italique).\n`;
        prompt += `8. Assure une progression narrative cohérente, respecte le genre et le ton demandés.\n`;
        prompt += `9. Adopte un style d'écriture adapté à un scénario de BD (visuel, dynamique).\n\n`;
        prompt += `FORMAT DE SORTIE ATTENDU (IMPORTANT - Suivre ce format EXACTEMENT) :\n`;
        prompt += `TITRE : [Titre de la BD en Français]\n\n`;
        prompt += `SYNOPSIS :\n[Synopsis en Français ici]\n\n`;
        prompt += `CHAPITRE 1 : [Titre du Chapitre 1 en Français]\n`;
        prompt += `PAGE 1 :\n`;
        prompt += `Case 1 : [Description Visuelle Case 1 en Français]. Dialogue: "..." Pensées: (...)\n`;
        prompt += `Case 2 : [Description Visuelle Case 2 en Français]. Dialogue: "..."\n`;
        prompt += `...\n`;
        prompt += `PAGE 2 :\n`;
        prompt += `Case 1 : [Description Visuelle Case 1 en Français]. Pensées: (...)\n`;
        prompt += `...\n`;
        prompt += `CHAPITRE 2 : [Titre du Chapitre 2 en Français]\n`;
        prompt += `PAGE X :\n`;
        prompt += `Case 1 : ...\n`;
        prompt += `...\n\n`;
        prompt += `**RAPPEL FINAL : TOUTE LA RÉPONSE DOIT ÊTRE EN FRANÇAIS.**\n`;
        prompt += `SCÉNARIO COMPLET CI-DESSOUS :\n`;
        prompt += `------------------------------------\n`;


        console.log("Sending prompt to AI:\n", prompt.substring(0, 500) + "...");

        try {
            const result = await generator(prompt, {
                max_new_tokens: 2048,
                temperature: 0.75, // Slightly increased temperature might help creativity/language
                top_p: 0.9,
                repetition_penalty: 1.15, // Slightly increased penalty
                // no_repeat_ngram_size: 3,
                // do_sample: true
            });

            const generatedText = result[0].generated_text.substring(prompt.length).trim();
            console.log("Raw AI Response (start):", generatedText.substring(0, 500) + "...");
             // Quick check if the response seems to be in Spanish or another language
             if (!generatedText.toLowerCase().includes("chapitre") && (generatedText.toLowerCase().includes("capítulo") || generatedText.toLowerCase().includes("chapter"))) {
                 console.warn("AI response might not be in French!");
                  // Decide if you want to throw an error here or let parsing try
                  // throw new Error("L'IA n'a pas répondu en français comme demandé.");
             }


            // --- Parse the generated text into a structured object ---
            const structuredScenario = parseScenarioTextImproved(generatedText); // Use the improved parser
            console.log("Parsed Scenario Structure:", structuredScenario);

            // Check if parsing was successful
            if (!structuredScenario.title || structuredScenario.title === "Titre Non Défini" || !structuredScenario.chapters || structuredScenario.chapters.length === 0 || structuredScenario.chapters[0].pages.length === 0) {
                 console.error("Parsing failed to extract essential structure.");
                 // Return the raw text within a basic structure for display
                 return {
                      title: structuredScenario.title || "Titre Non Trouvé",
                      synopsis: structuredScenario.synopsis || "Synopsis Non Trouvé",
                      chapters: [{
                          chapterNumber: 1,
                          title: "Chapitre 1 (Erreur de Structuration)",
                          pages: [], // Indicate no pages parsed
                          rawContent: generatedText // Provide raw content for debugging/display
                      }]
                 };
            }

            return structuredScenario;

        } catch (error) {
            console.error('Erreur lors de la génération du scénario par l\'IA:', error);
            throw new Error(`AI Scenario Generation Failed: ${error.message}`);
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
