import { GoogleGenerativeAI } from "@google/generative-ai";
import { Buffer } from 'buffer'; // Buffer est nécessaire pour le décodage Base64

const apiKey = process.env.GOOGLE_API_KEY;

// --- Helper Function to Parse Gemini's Outline Response (pas de changement) ---
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

export default async function handler(event, context) {
    console.log("Received event object:", JSON.stringify(event, null, 2));
    console.log("event.body type:", typeof event.body);
    console.log("event.isBase64Encoded:", event.isBase64Encoded);

    // Les headers pour les réponses JSON
    const jsonHeaders = { 'Content-Type': 'application/json' };

    if (!apiKey) {
        console.error("API Key not configured.");
        // MODIFICATION : Retourner un objet Response
        return new Response(JSON.stringify({ error: "API Key not configured." }), { status: 500, headers: jsonHeaders });
    }

    if (event.httpMethod !== "POST") {
        // MODIFICATION : Retourner un objet Response
        return new Response("Method Not Allowed", { status: 405, headers: { 'Allow': 'POST' } });
    }

    let inputData;
    let requestBodyString = event.body;

    if (event.isBase64Encoded && typeof requestBodyString === 'string') {
        try {
             requestBodyString = Buffer.from(requestBodyString, 'base64').toString('utf-8');
             console.log("Decoded Base64 body.");
        } catch(decodeError) {
            console.error("Failed to decode base64 body:", decodeError);
             // MODIFICATION : Retourner un objet Response
             return new Response(JSON.stringify({ error: "Failed to decode request body." }), { status: 400, headers: jsonHeaders });
        }
    } else if (typeof requestBodyString !== 'string') {
         console.error("Request body is not a string.");
         // MODIFICATION : Retourner un objet Response (Ce cas devrait être atteint avec le type 'object')
          return new Response(JSON.stringify({ error: `Invalid request body type: ${typeof requestBodyString}. Expected string.` }), { status: 400, headers: jsonHeaders }); // Ajout du type dans le message
    }

    try {
        inputData = JSON.parse(requestBodyString);
        console.log("Received parsed request data (outline w/ summary):", inputData);
    } catch (parseError) {
        console.error("Failed to parse request body as JSON:", parseError.message);
        // MODIFICATION : Retourner un objet Response
        return new Response(JSON.stringify({ error: "Invalid JSON body format." }), { status: 400, headers: jsonHeaders });
    }

    const { keywords, genre, style, tone, details } = inputData || {};

    if (!keywords || !genre || !style || !tone) {
        console.error("Missing required input fields after parsing:", { keywords, genre, style, tone });
        // MODIFICATION : Retourner un objet Response
        return new Response(JSON.stringify({ error: "Missing required input fields." }), { status: 400, headers: jsonHeaders });
    }

    console.log("--- CONSTRUCTING OUTLINE PROMPT (with summaries) ---");
    let prompt = `Tâche : Créer une **ossature détaillée** pour une bande dessinée d'environ 48 pages. NE PAS écrire le scénario complet, seulement l'organisation.\n\nINPUTS UTILISATEUR :\n- Idée/Mots-clés : ${keywords}\n- Genre : ${genre}\n- Style Visuel Cible (pour info) : ${style}\n- Ton : ${tone}\n`;
    if (details) { prompt += `- Détails Additionnels : ${details}\n`; }
    prompt += `\nINSTRUCTIONS SPÉCIFIQUES POUR L'OSSATURE :\n1. **Langue : ÉCRIS TOUTE LA RÉPONSE EN FRANÇAIS.**\n2. Crée un **TITRE GLOBAL** accrocheur.\n3. Divise l'histoire en environ **10 CHAPITRES** logiques.\n4. Pour **CHAQUE chapitre**, fournis :\n   - Un **TITRE DE CHAPITRE**.\n   - Un **RÉSUMÉ DE CHAPITRE** très court (**1 à 2 phrases MAXIMUM**).\n5. **NE PAS écrire les dialogues, descriptions de cases...**\n\nFORMAT DE SORTIE ATTENDU (IMPORTANT - Suivre EXACTEMENT) :\n\nTITRE GLOBAL : [Titre global ici]\n\nCHAPITRE 1 : [Titre Chapitre 1]\nRÉSUMÉ CHAPITRE 1 : [Résumé 1-2 phrases]\n\nCHAPITRE 2 : [Titre Chapitre 2]\nRÉSUMÉ CHAPITRE 2 : [Résumé 1-2 phrases]\n\n[...]\n\nCHAPITRE 10 : [Titre Chapitre 10]\nRÉSUMÉ CHAPITRE 10 : [Résumé 1-2 phrases]\n\n**RAPPEL FINAL : Génère UNIQUEMENT l'ossature (titre global, titres chapitres, résumés courts) en FRANÇAIS.**\nOSSATURE CI-DESSOUS :\n------------------------------------\n`;
    console.log("Sending OUTLINE prompt (with summaries) to Gemini...");

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

        const result = await model.generateContent(prompt);
        console.log("Received result object from Gemini (outline w/ summary).");
        const geminiResponse = await result.response;
        const text = geminiResponse.text();

        console.log("--- RAW TEXT FROM GEMINI (Outline w/ summary) ---\n" + text.substring(0, 500) + (text.length > 500 ? "..." : "") + "\n--- END RAW TEXT ---");

        const parsedOutline = parseOutline(text);

        if (parsedOutline.parsingError) { console.warn("Outline parsing failed."); }
        else { console.log("Outline parsed successfully."); }

        // MODIFICATION : Retourner un objet Response en cas de succès
        return new Response(JSON.stringify({ outline: parsedOutline }), { status: 200, headers: jsonHeaders });

    } catch (error) {
        console.error("Error calling Google AI API (outline w/ summary):", error);
        let errorMessage = `API call failed: ${error.message}`;
        let statusCode = 500;
         if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) { errorMessage = `Blocage Google : ${error.response.promptFeedback.blockReason}`; statusCode = 400; }
         else if (error.message?.includes('API key not valid')) { errorMessage = "Clé API invalide."; statusCode = 500; }
         else if (error.status === 404) { errorMessage = `Modèle non trouvé: ${error.message}`; statusCode = 404; }
         else if (error.status === 429 || error.message?.includes('429 Too Many Requests')) { errorMessage = `Quota API dépassé. Veuillez réessayer plus tard ou vérifier votre plan Google AI.`; statusCode = 429; }
         else if (error.status) { errorMessage = `Erreur API: ${error.status}`; statusCode = error.status; }
         else { errorMessage = `Erreur API générale: ${error.message}`; }

        // MODIFICATION : Retourner un objet Response en cas d'erreur
        return new Response(JSON.stringify({ error: `Échec génération ossature.`, details: errorMessage }), { status: statusCode, headers: jsonHeaders });
    }
}