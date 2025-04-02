// Use an IIFE to encapsulate the code and avoid polluting the global scope
(function() {
    let pipelineInstance = null;
    let isPipelineLoading = false;
    const modelName = 'Felladrin/onnx-bloomz-560m-sft-chat'; // Model for generation

    // --- Initialize Pipeline ---
    async function getPipeline() {
        if (pipelineInstance) {
            return pipelineInstance;
        }
        if (isPipelineLoading) {
            // Wait for the existing loading process to complete
            await new Promise(resolve => setTimeout(resolve, 100)); // Simple polling
            return getPipeline(); // Retry getting the instance
        }

        isPipelineLoading = true;
        console.log("Loading text generation pipeline...");
        try {
            const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.0');
            pipelineInstance = await pipeline('text-generation', modelName, {
                progress_callback: (progress) => {
                    console.log("Model loading progress:", progress);
                    // Optional: Update a loading bar UI element here
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
     * Aims for a structured output.
     */
    async function generateStory(keywords, genre, style, tone, details) {
        console.log("Starting scenario generation...");
        const generator = await getPipeline();

        // --- Construct Detailed Prompt for Scenario Structure ---
        // This is the most critical part for guiding the free model
        let prompt = `Tâche : Écrire un scénario détaillé pour une bande dessinée.\n\n`;
        prompt += `INPUTS UTILISATEUR :\n`;
        prompt += `- Idée/Mots-clés : ${keywords}\n`;
        prompt += `- Genre : ${genre}\n`;
        prompt += `- Style Visuel Cible (pour info) : ${style}\n`;
        prompt += `- Ton : ${tone}\n`;
        if (details) {
            prompt += `- Détails Additionnels (Personnages, Univers) : ${details}\n`;
        }
        prompt += `\nINSTRUCTIONS :\n`;
        prompt += `1. Crée un titre accrocheur pour la BD.\n`;
        prompt += `2. Écris un synopsis court (2-3 paragraphes) qui résume l'intrigue principale, les personnages clés et les enjeux.\n`;
        prompt += `3. Divise l'histoire en 3 à 5 chapitres logiques. Donne un titre à chaque chapitre.\n`;
        prompt += `4. Pour CHAQUE chapitre, détaille le contenu page par page (vise 5-10 pages par chapitre).\n`;
        prompt += `5. Pour CHAQUE page, décris le contenu de 3 à 6 cases (panels).\n`;
        prompt += `6. Pour CHAQUE case, fournis IMPÉRATIVEMENT :\n`;
        prompt += `   - Description visuelle concise (ce qu'on voit : décor, action, personnages).\n`;
        prompt += `   - Dialogue (si présent, entre guillemets).\n`;
        prompt += `   - Pensées (si présentes, entre parenthèses et en italique).\n`;
        prompt += `7. Assure une progression narrative cohérente, respecte le genre et le ton demandés.\n`;
        prompt += `8. Adopte un style d'écriture adapté à un scénario de BD (visuel, dynamique).\n\n`;
        prompt += `FORMAT DE SORTIE ATTENDU (IMPORTANT - Suivre ce format EXACTEMENT) :\n`;
        prompt += `TITRE : [Titre de la BD]\n\n`;
        prompt += `SYNOPSIS :\n[Synopsis ici]\n\n`;
        prompt += `CHAPITRE 1 : [Titre du Chapitre 1]\n`;
        prompt += `PAGE 1 :\n`;
        prompt += `Case 1 : [Description Visuelle Case 1]. Dialogue: "..." Pensées: (...)\n`;
        prompt += `Case 2 : [Description Visuelle Case 2]. Dialogue: "..."\n`;
        prompt += `...\n`;
        prompt += `PAGE 2 :\n`;
        prompt += `Case 1 : [Description Visuelle Case 1]. Pensées: (...)\n`;
        prompt += `...\n`;
        prompt += `CHAPITRE 2 : [Titre du Chapitre 2]\n`;
        prompt += `PAGE X :\n`;
        prompt += `Case 1 : ...\n`;
        prompt += `...\n\n`;
        prompt += `SCÉNARIO COMPLET CI-DESSOUS :\n`;
        prompt += `------------------------------------\n`;

        console.log("Sending prompt to AI:\n", prompt.substring(0, 500) + "..."); // Log start of prompt

        try {
            const result = await generator(prompt, {
                max_new_tokens: 2048, // Increased token limit, adjust based on model capacity/performance
                temperature: 0.7,
                top_p: 0.9,
                repetition_penalty: 1.1,
                // no_repeat_ngram_size: 3, // Can help reduce repetition
                // do_sample: true // Ensure sampling for temperature/top_p
            });

            const generatedText = result[0].generated_text.substring(prompt.length).trim();
            console.log("Raw AI Response (start):", generatedText.substring(0, 500) + "...");

            // --- Parse the generated text into a structured object ---
            const structuredScenario = parseScenarioText(generatedText);
            console.log("Parsed Scenario Structure:", structuredScenario);

            if (!structuredScenario.title || !structuredScenario.chapters || structuredScenario.chapters.length === 0) {
                 console.error("Parsing failed to extract essential structure.");
                 // Attempt a simpler extraction if parsing fails
                 return {
                      title: "Titre Non Trouvé",
                      synopsis: "Synopsis Non Trouvé",
                      chapters: [{ title: "Chapitre 1 (Brut)", summary: generatedText, pages: [] }] // Return raw text as a fallback chapter
                 };
                 // throw new Error("L'IA n'a pas retourné un scénario structuré correctement. Essayez de simplifier l'idée.");
            }

            return structuredScenario;

        } catch (error) {
            console.error('Erreur lors de la génération du scénario par l\'IA:', error);
            throw new Error(`AI Scenario Generation Failed: ${error.message}`);
        }
    }

     /**
     * Parses the raw text output from the LLM into a structured scenario object.
     * This is complex and prone to errors if the LLM doesn't follow the format.
     */
     function parseScenarioText(text) {
         const scenario = {
             title: "Titre Non Défini",
             synopsis: "",
             chapters: []
         };
         let currentChapter = null;
         let currentPage = null;

         const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

         const titleMatch = text.match(/TITRE\s*:\s*(.*)/i);
         if (titleMatch) scenario.title = titleMatch[1].trim();

         const synopsisMatch = text.match(/SYNOPSIS\s*:\s*([\s\S]*?)(?=CHAPITRE|\n\n-{3,}|$)/i);
         if (synopsisMatch) scenario.synopsis = synopsisMatch[1].trim();

         lines.forEach(line => {
             // Chapter Title
             const chapterMatch = line.match(/CHAPITRE\s+(\d+)\s*:\s*(.*)/i);
             if (chapterMatch) {
                 currentChapter = {
                     chapterNumber: parseInt(chapterMatch[1]),
                     title: chapterMatch[2].trim(),
                     pages: []
                 };
                 scenario.chapters.push(currentChapter);
                 currentPage = null; // Reset page when new chapter starts
                 return; // Move to next line
             }

             if (!currentChapter) return; // Skip lines before the first chapter definition

             // Page Number
             const pageMatch = line.match(/PAGE\s+(\d+)\s*:/i);
             if (pageMatch) {
                 currentPage = {
                     pageNumber: parseInt(pageMatch[1]),
                     panels: []
                 };
                 currentChapter.pages.push(currentPage);
                 return; // Move to next line
             }

             if (!currentPage) return; // Skip lines before the first page definition in a chapter

             // Panel (Case) Details - This regex is complex and might need refinement
             // It tries to capture Panel #, Description, optional Dialogue, optional Thoughts
             const panelMatch = line.match(/Case\s+(\d+)\s*:\s*(.*?)(?:Dialogue:\s*"(.*?)")?(?:Pensées:\s*\((.*?)\))?$/i);
              if (panelMatch) {
                  currentPage.panels.push({
                      panelNumber: parseInt(panelMatch[1]),
                      description: panelMatch[2].trim().replace(/Dialogue:.*|Pensées:.*/i, '').trim(), // Clean up description
                      dialogue: panelMatch[3] ? panelMatch[3].trim() : null,
                      thoughts: panelMatch[4] ? panelMatch[4].trim() : null
                  });
              } else {
                  // If the strict format fails, maybe it's just a description line for the last panel?
                  // Or maybe it's part of a multi-line description. This is tricky.
                  // For simplicity now, we only add panels if they match the format.
                  // console.warn("Line not matching panel format:", line);
                   // Fallback: Add line as description to the last panel if it exists
                   if(currentPage.panels.length > 0 && line.length > 10) { // Avoid adding short lines
                       let lastPanel = currentPage.panels[currentPage.panels.length - 1];
                       lastPanel.description += " " + line; // Append non-matching line
                   }
              }
         });

         // Basic validation/cleanup
         if(scenario.chapters.length === 0 && scenario.synopsis.length > 50) {
             // If no chapters parsed but synopsis exists, maybe the whole text is the synopsis/story
             scenario.chapters.push({ chapterNumber: 1, title: "Histoire Principale (Non Structurée)", pages: [], summary: scenario.synopsis });
             scenario.synopsis = "(Synopsis non extrait séparément)";
         }


         return scenario;
     }


    /**
     * Generates storyboard suggestions (framing, composition) for a given chapter's panels.
     */
    async function generateStoryboardChapter(chapterPanelData, style, tone) {
        console.log("Generating storyboard suggestions for chapter...");
        const generator = await getPipeline();
        const storyboardResults = [];

         // Process panels sequentially to avoid overwhelming the model (maybe batch later)
         for (const panel of chapterPanelData) {
             const panelDesc = panel.description || "Scène sans description";
             const prompt = `Tâche : Suggérer des éléments de storyboard pour une case de BD.\n\n`;
             prompt += `CONTEXTE :\n`;
             prompt += `- Style Visuel Global : ${style}\n`;
             prompt += `- Ton Général : ${tone}\n`;
             prompt += `- Description du Scénario pour cette Case : ${panelDesc}\n`;
             if (panel.dialogue) prompt += `- Dialogue : "${panel.dialogue}"\n`;
             if (panel.thoughts) prompt += `- Pensées : (${panel.thoughts})\n`;
             prompt += `\nINSTRUCTIONS :\n`;
             prompt += `1. Suggère UN type de Cadrage (ex: Gros plan, Plan américain, Plan moyen, Plan large, Vue plongeante, Contre-plongée, Plan d'ensemble).\n`;
             prompt += `2. Décris brièvement la Composition clé de l'image (ex: Personnage centré, Règle des tiers, Lignes directrices vers le sujet, Espace négatif important).\n`;
             prompt += `3. Sois concis.\n\n`;
             prompt += `FORMAT DE SORTIE ATTENDU (une seule ligne) :\n`;
             prompt += `Cadrage: [Type de Cadrage] / Composition: [Description Composition]\n\n`;
             prompt += `SUGGESTION CI-DESSOUS :\n`;
             prompt += `-----------------------\n`;

             try {
                 const result = await generator(prompt, {
                     max_new_tokens: 50, // Short response expected
                     temperature: 0.6,
                     repetition_penalty: 1.1,
                     // do_sample: true
                 });
                 const suggestionText = result[0].generated_text.substring(prompt.length).trim();

                 // Parse the suggestion
                 const cadrageMatch = suggestionText.match(/Cadrage:\s*([^/]+)/i);
                 const compositionMatch = suggestionText.match(/Composition:\s*(.*)/i);

                 storyboardResults.push({
                     pageNumber: panel.pageNumber,
                     panelNumber: panel.panelNumber,
                     scenarioDesc: panelDesc,
                     framing: cadrageMatch ? cadrageMatch[1].trim() : "Non suggéré",
                     composition: compositionMatch ? compositionMatch[1].trim() : "Non suggérée"
                 });
                  // Add a small delay to potentially avoid rate limits or improve stability
                  await new Promise(resolve => setTimeout(resolve, 100));

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
     */
    async function generatePromptsForChapter(storyboardChapterData, style, tone) {
        console.log("Generating Midjourney prompts for chapter...");
        const generator = await getPipeline();
        const promptResults = [];

        // Map style and tone to potential Midjourney keywords (simple example)
        const styleKeywords = getStyleKeywords(style);
        const toneKeywords = getToneKeywords(tone);

        for (const panel of storyboardChapterData) {
             const baseDesc = panel.scenarioDesc || "comic panel";
             const framing = panel.framing || "medium shot"; // Default if not specified
             const composition = panel.composition || "";

             // Construct prompt for the LLM to generate the Midjourney prompt
             const prompt = `Tâche : Générer un prompt optimisé pour Midjourney v6 pour une case de bande dessinée.\n\n`;
             prompt += `CONTEXTE DE LA CASE :\n`;
             prompt += `- Description Scénario : ${baseDesc}\n`;
             prompt += `- Cadrage : ${framing}\n`;
             prompt += `- Composition : ${composition}\n`;
             prompt += `- Style Visuel Global : ${style} (${styleKeywords})\n`;
             prompt += `- Ton Général : ${tone} (${toneKeywords})\n`;
             prompt += `\nINSTRUCTIONS :\n`;
             prompt += `1. Crée un prompt en ANGLAIS pour Midjourney (/imagine prompt: ...).\n`;
             prompt += `2. Combine la description, le cadrage, la composition, le style et le ton.\n`;
             prompt += `3. Utilise des mots-clés descriptifs et évocateurs en ANGLAIS.\n`;
             prompt += `4. Inclus les mots-clés de style : ${styleKeywords}.\n`;
             prompt += `5. Inclus des mots-clés de ton/ambiance : ${toneKeywords}.\n`;
             prompt += `6. Ajoute des termes qualitatifs comme "detailed illustration", "cinematic", "high quality".\n`;
             prompt += `7. Ajoute le paramètre d'aspect ratio '--ar 3:2' (ou adapte si pertinent).\n`;
             prompt += `8. Sois créatif mais fidèle au contexte fourni.\n\n`;
             prompt += `FORMAT DE SORTIE ATTENDU (une seule ligne) :\n`;
             prompt += `/imagine prompt: [Prompt Midjourney en anglais ici] --ar 3:2 --v 6\n\n`;
             prompt += `PROMPT MIDJOURNEY CI-DESSOUS :\n`;
             prompt += `-----------------------------\n`;


             try {
                 const result = await generator(prompt, {
                     max_new_tokens: 150, // Midjourney prompts can be long
                     temperature: 0.7,
                     repetition_penalty: 1.1,
                      // do_sample: true
                 });
                 let mjPrompt = result[0].generated_text.substring(prompt.length).trim();

                 // Basic cleanup - ensure it starts correctly and has aspect ratio
                 if (!mjPrompt.toLowerCase().startsWith('/imagine prompt:')) {
                     mjPrompt = `/imagine prompt: ${mjPrompt}`;
                 }
                  if (!mjPrompt.includes('--ar')) {
                      mjPrompt += ' --ar 3:2'; // Add aspect ratio if missing
                  }
                   if (!mjPrompt.includes('--v')) {
                       mjPrompt += ' --v 6'; // Add version if missing
                   }

                 promptResults.push({
                     pageNumber: panel.pageNumber,
                     panelNumber: panel.panelNumber,
                     description: baseDesc, // Keep original description for reference
                     prompt: mjPrompt
                 });
                  await new Promise(resolve => setTimeout(resolve, 100));

             } catch (error) {
                  console.error(`Error generating Midjourney prompt for panel ${panel.panelNumber}:`, error);
                  promptResults.push({
                      pageNumber: panel.pageNumber,
                      panelNumber: panel.panelNumber,
                      description: baseDesc,
                      prompt: `/imagine prompt: Error generating prompt for: ${baseDesc}, ${framing}, ${styleKeywords} --ar 3:2 --v 6`
                  });
             }
        }
        console.log("Midjourney prompts generated:", promptResults);
        return promptResults;
    }

    // --- Helper Functions ---
     function getStyleKeywords(style) {
         const mapping = {
             "Manga": "manga style, anime art, detailed line art, dynamic panels",
             "Franco-Belge": "franco-belgian comic style, ligne claire, clear line art, Herge Tintin style",
             "Comics US": "american comic book style, superhero art, dynamic action poses, bold colors, ink outlines",
             "Réaliste": "realistic digital painting, detailed illustration, cinematic lighting, volumetric light",
             "Cartoon": "cartoon style, animation cel, fun characters, simple background",
             "Aquarelle": "watercolor illustration style, soft edges, vibrant washes, wet-on-wet technique",
             // Add more mappings
         };
         return mapping[style] || style; // Return style name itself if no specific keywords
     }

     function getToneKeywords(tone) {
          const mapping = {
             "Épique": "epic scale, dramatic lighting, heroic poses, vast landscape",
             "Sérieux": "serious mood, realistic expressions, grounded setting, muted colors",
             "Léger / Humoristique": "lighthearted, funny expressions, bright colors, comedic timing",
             "Sombre / Mature": "dark atmosphere, gritty texture, noir lighting, intense emotion, shadow",
             "Mystérieux": "mysterious fog, hidden details, suspenseful composition, silhouette",
             "Poétique": "poetic atmosphere, soft focus, symbolic imagery, ethereal light",
              // Add more mappings
          };
          return mapping[tone] || tone;
     }

     // --- Modification/Regeneration Placeholders ---
     // These would require more complex logic to take existing data and the modification
     // request, craft a new prompt for the AI, and parse the result.

     async function modifyScenario(currentScenarioData, modificationRequest, genre, style, tone) {
         console.warn("modifyScenario function is not fully implemented.");
         // 1. Create a prompt telling the AI to modify `currentScenarioData` based on `modificationRequest`.
         // 2. Call the AI.
         // 3. Parse the result.
         // 4. Return the modified structured data.
         alert("La modification de scénario n'est pas implémentée dans cette démo.");
         return currentScenarioData; // Return original data for now
     }

      async function modifyStoryboardChapter(currentStoryboardData, modificationRequest, style, tone) {
         console.warn("modifyStoryboardChapter function is not fully implemented.");
         alert("La modification de storyboard n'est pas implémentée dans cette démo.");
         return currentStoryboardData;
     }


    // Expose functions to the global scope (or module exports if using modules)
    window.generateStory = generateStory;
    window.generateStoryboardChapter = generateStoryboardChapter;
    window.generatePromptsForChapter = generatePromptsForChapter;
    window.modifyScenario = modifyScenario; // Expose placeholders
    window.modifyStoryboardChapter = modifyStoryboardChapter;

})(); // Immediately invoke the function expression
