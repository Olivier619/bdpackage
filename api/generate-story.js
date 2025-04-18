// api/generate-story.js
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_API_KEY;

// --- Helper Function to Parse Gemini's Outline Response (avec résumés) ---
function parseOutline(text) {
    console.log("Attempting to parse outline text (with summaries):\n", text.substring(0, 300) + "...");
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    let title = "N/A";
    const chapters = [];
    let currentChapterNum = null;

    try {
        const titleMatch = text.match(/TITRE GLOBAL\s*:\s*(.*)/i);
        if (titleMatch && titleMatch[1]) {
            title = titleMatch[1].trim();
            console.log("Parsed Global Title:", title);
        } else {
             if(lines[0] && !lines[0].match(/^(CHAPITRE|RÉSUMÉ)/i)) {
                title = lines[0]; console.warn("Could not find 'TITRE GLOBAL:', using first line:", title);
             } else { console.warn("Could not find 'TITRE GLOBAL:' and first line didn't look like a title."); }
        }

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const chapterTitleMatch = line.match(/^CHAPITRE\s+(\d+)\s*:\s*(.*)/i);
            const chapterSummaryMatch = line.match(/^RÉSUMÉ CHAPITRE\s+(\d+)\s*:\s*(.*)/i);

            if (chapterTitleMatch) {
                currentChapterNum = parseInt(chapterTitleMatch[1], 10);
                const chapterTitle = chapterTitleMatch[2].trim();
                let existingChapter = chapters.find(ch => ch.chapter === currentChapterNum);
                if (!existingChapter) { chapters.push({ chapter: currentChapterNum, title: chapterTitle, summary: "" }); console.log(`Parsed Chapter ${currentChapterNum} Title: ${chapterTitle}`); }
                else { existingChapter.title = chapterTitle; console.log(`Updated Chapter ${currentChapterNum} Title: ${chapterTitle}`); }
            } else if (chapterSummaryMatch) {
                const summaryChapterNum = parseInt(chapterSummaryMatch[1], 10);
                const chapterSummary = chapterSummaryMatch[2].trim();
                 let chapterToUpdate = chapters.find(ch => ch.chapter === summaryChapterNum);
                 if(chapterToUpdate) { chapterToUpdate.summary = chapterSummary; console.log(`Parsed Chapter ${summaryChapterNum} Summary: ${chapterSummary}`); }
                 else { chapters.push({ chapter: summaryChapterNum, title: `Chapitre ${summaryChapterNum} (Titre à venir)`, summary: chapterSummary }); console.warn(`Parsed Chapter ${summaryChapterNum} Summary found before title.`); }
                 currentChapterNum = null;
            }
        }
        chapters.sort((a, b) => a.chapter - b.chapter);
        console.log("Final Parsed Chapters (with summaries):", chapters);
        if (title === "N/A" && chapters.length === 0) { throw new Error("Parsing failed: No title or chapters found."); }
        chapters.forEach(ch => { if (ch.title === `Chapitre ${ch.chapter} (Titre à venir)`) { ch.title = `Chapitre ${ch.chapter} (Titre Manquant)`; } if (ch.summary === undefined) ch.summary = ""; });
        return { title, chapters };
    } catch (parseError) {
        console.error("Error during outline parsing (with summaries):", parseError);
        return { title: "Erreur Parsing", chapters: [], rawText: text, parsingError: parseError.message };
    }
}
// --- End Helper Function ---

export default async function handler(request, response) {
    if (!apiKey) { console.error("API Key missing"); return response.status(500).json({ error: "API Key not configured." }); }
    if (request.method !== "POST") { response.setHeader('Allow', ['POST']); return response.status(405).end('Method Not Allowed'); }

    const inputData = request.body;
    console.log("Received request data (outline w/ summary):", inputData);
    const { keywords, genre, style, tone, details } = inputData || {};

    if (!keywords || !genre || !style || !tone) { console.error("Missing fields:", { keywords, genre, style, tone }); return response.status(400).json({ error: "Missing required input fields." }); }

    console.log("--- CONSTRUCTING OUTLINE PROMPT (with summaries) ---");
    let prompt = `Tâche : Créer une **ossature détaillée** pour une bande dessinée d'environ 48 pages. NE PAS écrire le scénario complet, seulement l'organisation.\n\nINPUTS UTILISATEUR :\n- Idée/Mots-clés : ${keywords}\n- Genre : ${genre}\n- Style Visuel Cible (pour info) : ${style}\n- Ton : ${tone}\n`;
    if (details) { prompt += `- Détails Additionnels : ${details}\n`; }
    prompt += `\nINSTRUCTIONS SPÉCIFIQUES POUR L'OSSATURE :\n1. **Langue : ÉCRIS TOUTE LA RÉPONSE EN FRANÇAIS.**\n2. Crée un **TITRE GLOBAL** accrocheur.\n3. Divise l'histoire en environ **10 CHAPITRES** logiques.\n4. Pour **CHAQUE chapitre**, fournis :\n   - Un **TITRE DE CHAPITRE**.\n   - Un **RÉSUMÉ DE CHAPITRE** très court (**1 à 2 phrases MAXIMUM**).\n5. **NE PAS écrire les dialogues, descriptions de cases...**\n\nFORMAT DE SORTIE ATTENDU (IMPORTANT - Suivre EXACTEMENT) :\n\nTITRE GLOBAL : [Titre global ici]\n\nCHAPITRE 1 : [Titre Chapitre 1]\nRÉSUMÉ CHAPITRE 1 : [Résumé 1-2 phrases]\n\nCHAPITRE 2 : [Titre Chapitre 2]\nRÉSUMÉ CHAPITRE 2 : [Résumé 1-2 phrases]\n\n[...]\n\nCHAPITRE 10 : [Titre Chapitre 10]\nRÉSUMÉ CHAPITRE 10 : [Résumé 1-2 phrases]\n\n**RAPPEL FINAL : Génère UNIQUEMENT l'ossature (titre global, titres chapitres, résumés courts) en FRANÇAIS.**\nOSSATURE CI-DESSOUS :\n------------------------------------\n`;

    console.log("Sending OUTLINE prompt (with summaries) to Gemini...");

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" }); // Utilisation de 1.5 Pro

        const result = await model.generateContent(prompt);
        console.log("Received result object from Gemini (outline w/ summary).");
        const geminiResponse = await result.response;
        const text = geminiResponse.text();

        console.log("--- RAW TEXT FROM GEMINI (Outline w/ summary) ---\n" + text.substring(0, 500) + (text.length > 500 ? "..." : "") + "\n--- END RAW TEXT ---");

        const parsedOutline = parseOutline(text);

        if (parsedOutline.parsingError) { console.warn("Outline parsing failed."); }
        else { console.log("Outline parsed successfully."); }

        return response.status(200).json({ outline: parsedOutline });

    } catch (error) {
        console.error("Error calling Google AI API (outline w/ summary):", error);
        let errorMessage = `API call failed: ${error.message}`;
        let statusCode = 500;
        if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) { errorMessage = `Blocage Google : ${error.response.promptFeedback.blockReason}`; statusCode = 400; }
        else if (error.message?.includes('API key not valid')) { errorMessage = "Clé API invalide."; statusCode = 500; }
        else if (error.status === 404) { errorMessage = `Modèle non trouvé: ${error.message}`; statusCode = 404;}
        else if (error.status) { errorMessage = `Erreur API: ${error.message}`; statusCode = error.status; }
        return response.status(statusCode).json({ error: "Échec génération ossature.", details: errorMessage });
    }
}
