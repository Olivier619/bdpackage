// api/generate-story.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY;

// --- Helper Function to Parse Gemini's Outline Response (avec résumés) ---
function parseOutline(text) {
    console.log("Attempting to parse outline text (with summaries):\n", text.substring(0, 300) + "..."); // Log début texte
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let title = "N/A";
    const chapters = [];
    let currentChapterNum = null; // Pour associer résumé et titre

    try {
        // Chercher TITRE GLOBAL en priorité
        const titleMatch = text.match(/TITRE GLOBAL\s*:\s*(.*)/i);
        if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].trim();
            console.log("Parsed Global Title:", title);
        } else {
             // Fallback : prend la première ligne non vide si elle ne ressemble pas à autre chose
             if(lines[0] && !lines[0].match(/^(CHAPITRE|RÉSUMÉ)/i)) {
                title = lines[0];
                console.warn("Could not find 'TITRE GLOBAL:', using first line as potential title:", title);
             } else {
                console.warn("Could not find 'TITRE GLOBAL:' and first line didn't look like a title.");
             }
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const chapterTitleMatch = line.match(/^CHAPITRE\s+(\d+)\s*:\s*(.*)/i);
            const chapterSummaryMatch = line.match(/^RÉSUMÉ CHAPITRE\s+(\d+)\s*:\s*(.*)/i);

            if (chapterTitleMatch) {
                currentChapterNum = parseInt(chapterTitleMatch[1], 10);
                const chapterTitle = chapterTitleMatch[2].trim();
                // Chercher si le chapitre existe déjà (si le résumé a été trouvé avant)
                let existingChapter = chapters.find(ch => ch.chapter === currentChapterNum);
                if (!existingChapter) {
                    chapters.push({
                        chapter: currentChapterNum,
                        title: chapterTitle,
                        summary: "" // Placeholder, sera rempli si résumé trouvé après
                    });
                    console.log(`Parsed Chapter ${currentChapterNum} Title: ${chapterTitle}`);
                } else {
                    existingChapter.title = chapterTitle; // Met à jour le titre
                    console.log(`Updated Chapter ${currentChapterNum} Title: ${chapterTitle}`);
                }
            } else if (chapterSummaryMatch) {
                const summaryChapterNum = parseInt(chapterSummaryMatch[1], 10);
                const chapterSummary = chapterSummaryMatch[2].trim();
                 // Chercher si le chapitre existe déjà (si le titre a été trouvé avant)
                 let chapterToUpdate = chapters.find(ch => ch.chapter === summaryChapterNum);
                 if(chapterToUpdate) {
                     chapterToUpdate.summary = chapterSummary;
                     console.log(`Parsed Chapter ${summaryChapterNum} Summary: ${chapterSummary}`);
                 } else {
                     // Le résumé est trouvé avant le titre
                     chapters.push({
                         chapter: summaryChapterNum,
                         title: `Chapitre ${summaryChapterNum} (Titre à venir)`, // Titre temporaire
                         summary: chapterSummary
                     });
                     console.warn(`Parsed Chapter ${summaryChapterNum} Summary found before title.`);
                 }
                 currentChapterNum = null; // Réinitialiser après avoir traité un résumé
            } else if (currentChapterNum !== null) {
                 // Si on est après un titre de chapitre et que ce n'est ni un titre ni un résumé,
                 // ça pourrait être la suite du titre ou un début de résumé non formaté? Ignorons pour l'instant.
                 // console.log(`Ignoring line after Chapter ${currentChapterNum} title: ${line}`);
            }
        }

        chapters.sort((a, b) => a.chapter - b.chapter);
        console.log("Final Parsed Chapters (with summaries):", chapters);

        // Vérifier si on a au moins un titre ou des chapitres
        if (title === "N/A" && chapters.length === 0) {
            throw new Error("Parsing failed completely. No title or chapters found.");
        }

        // Nettoyer les titres temporaires si le titre réel n'a pas été trouvé plus tard
        chapters.forEach(ch => {
            if (ch.title === `Chapitre ${ch.chapter} (Titre à venir)`) {
                console.warn(`Title for chapter ${ch.chapter} was never found after summary.`);
                ch.title = `Chapitre ${ch.chapter} (Titre Manquant)`;
            }
            // Assurer qu'il y a un résumé, même vide
            if (ch.summary === undefined) ch.summary = "";
        });


        return { title, chapters };

    } catch (parseError) {
        console.error("Error during outline parsing (with summaries):", parseError);
        return { title: "Erreur Parsing", chapters: [], rawText: text, parsingError: parseError.message };
    }
}
// --- End Helper Function ---


// --- VERCEL EXPORT DEFAULT ---
export default async function handler(request, response) {
    if (!apiKey) {
        console.error("ERROR: GOOGLE_API_KEY environment variable not set.");
        return response.status(500).json({ error: "API Key not configured." });
    }
    if (request.method !== "POST") {
        response.setHeader('Allow', ['POST']);
        return response.status(405).end('Method Not Allowed');
    }

    const inputData = request.body;
    console.log("Received request data (outline w/ summary):", inputData);
    const { keywords, genre, style, tone, details } = inputData || {};

    if (!keywords || !genre || !style || !tone) {
         console.error("Missing required fields:", { keywords, genre, style, tone });
        return response.status(400).json({ error: "Missing required input fields." });
    }

    // --- PROMPT RETABLI (DEMANDE TITRE GLOBAL, TITRES CHAPITRES, RÉSUMÉS COURTS) ---
    console.log("--- CONSTRUCTING OUTLINE PROMPT (with summaries) ---");
    let prompt = `Tâche : Créer une **ossature détaillée** pour une bande dessinée d'environ 48 pages. NE PAS écrire le scénario complet, seulement l'organisation.\n\n`;
    prompt += `INPUTS UTILISATEUR :\n`;
    prompt += `- Idée/Mots-clés : ${keywords}\n`;
    prompt += `- Genre : ${genre}\n`;
    prompt += `- Style Visuel Cible (pour info) : ${style}\n`;
    prompt += `- Ton : ${tone}\n`;
    if (details) { prompt += `- Détails Additionnels : ${details}\n`; }
    prompt += `\nINSTRUCTIONS SPÉCIFIQUES POUR L'OSSATURE :\n`;
    prompt += `1. **Langue : ÉCRIS TOUTE LA RÉPONSE EN FRANÇAIS.**\n`;
    prompt += `2. Crée un **TITRE GLOBAL** accrocheur pour la BD.\n`;
    prompt += `3. Divise l'histoire en environ **10 CHAPITRES** logiques (pour viser 4-5 pages de BD par chapitre).\n`;
    prompt += `4. Pour **CHAQUE chapitre**, fournis :\n`;
    prompt += `   - Un **TITRE DE CHAPITRE** clair et évocateur.\n`;
    prompt += `   - Un **RÉSUMÉ DE CHAPITRE** très court (**1 à 2 phrases MAXIMUM**) décrivant l'événement principal ou le but de ce chapitre.\n`; // Résumé demandé
    prompt += `5. **NE PAS écrire les dialogues, descriptions de cases, ou le scénario détaillé des chapitres.**\n`;
    prompt += `\nFORMAT DE SORTIE ATTENDU (IMPORTANT - Suivre ce format EXACTEMENT) :\n\n`;
    prompt += `TITRE GLOBAL : [Titre global ici en Français]\n\n`;
    prompt += `CHAPITRE 1 : [Titre Chapitre 1 en Français]\n`;
    prompt += `RÉSUMÉ CHAPITRE 1 : [Résumé 1-2 phrases en Français]\n\n`; // Format avec résumé
    prompt += `CHAPITRE 2 : [Titre Chapitre 2 en Français]\n`;
    prompt += `RÉSUMÉ CHAPITRE 2 : [Résumé 1-2 phrases en Français]\n\n`; // Format avec résumé
    prompt += `[...] (Continuer pour environ 10 chapitres)\n\n`;
    prompt += `CHAPITRE 10 : [Titre Chapitre 10 en Français]\n`;
    prompt += `RÉSUMÉ CHAPITRE 10 : [Résumé 1-2 phrases en Français]\n\n`; // Format avec résumé
    prompt += `**RAPPEL FINAL : Génère UNIQUEMENT l'ossature (titre global, titres chapitres, résumés courts) en FRANÇAIS et respecte le format demandé.**\n`;
    prompt += `OSSATURE CI-DESSOUS :\n`;
    prompt += `------------------------------------\n`;
    // --- FIN PROMPT RETABLI ---

    console.log("Sending OUTLINE prompt (with summaries) to Gemini...");

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        // Utiliser gemini-1.5-pro-latest en espérant que Vercel a un timeout > 10s
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

        const result = await model.generateContent(prompt);
        console.log("Received result object from Gemini (outline w/ summary).");
        const geminiResponse = await result.response;
        const text = geminiResponse.text();

        // Log brut pour debug
        console.log("--- RAW TEXT FROM GEMINI (Outline w/ summary) ---");
        console.log(text.substring(0, 500) + (text.length > 500 ? "..." : "")); // Log début texte brut
        console.log("--- END RAW TEXT ---");


        const parsedOutline = parseOutline(text); // Utiliser le parser qui attend les résumés

        if (parsedOutline.parsingError) {
             console.warn("Outline parsing failed (with summaries), returning raw text structure.");
        } else {
             console.log("Outline parsed successfully (with summaries).");
        }

        return response.status(200).json({ outline: parsedOutline });

    } catch (error) {
        console.error("Error calling Google AI API (outline w/ summary):", error);
         let errorMessage = `API call failed: ${error.message}`;
         let statusCode = 500;
          // ... (gestion d'erreur identique à avant) ...
          if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) { errorMessage = `... ${error.response.promptFeedback.blockReason}`; statusCode = 400; }
          else if (error.message?.includes('API key not valid')) { errorMessage = "..."; statusCode = 500; }
          else if (error.status === 404) { errorMessage = `... ${error.message} ...`; statusCode = 404;}
          else if (error.status) { errorMessage = `... ${error.message}`; statusCode = error.status; }
        return response.status(statusCode).json({ error: "Failed to generate outline (with summaries) via API.", details: errorMessage });
    }
}la syntaxe Vercel
        return response.status(statusCode).json({ error: "Failed to generate simple outline via API.", details: errorMessage });
    }
}
