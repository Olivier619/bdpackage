import { GoogleGenerativeAI } from "@google/generative-ai";

// La clé API est correctement lue depuis les variables d'environnement, c'est bien !
const apiKey = process.env.GOOGLE_API_KEY;

// --- Helper Function to Parse Gemini's Outline Response (avec résumés) ---
// (Pas de changement nécessaire ici, elle est appelée plus loin dans la fonction)
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

// MODIFICATION MAJEURE : Changer la signature de la fonction pour le format Netlify Functions (event, context)
export default async function handler(event, context) { // <-- CHANGÉ ICI

    // Log pour voir l'objet event reçu
    console.log("Received event object:", JSON.stringify(event, null, 2)); // Log complet de l'event

    if (!apiKey) {
        console.error("API Key missing");
        // Retourner au format Netlify Functions
        return {
            statusCode: 500,
            body: JSON.stringify({ error: "API Key not configured." }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    if (event.httpMethod !== "POST") { // Accéder à la méthode via event
        // Retourner au format Netlify Functions
        return {
            statusCode: 405,
            body: "Method Not Allowed",
            headers: { 'Allow': 'POST' }
        };
    }

    let inputData;
    try {
        // MODIFICATION : Lire et parser le corps de la requête
        inputData = JSON.parse(event.body); // event.body contient le corps comme une chaîne de caractères
        console.log("Received parsed request data (outline w/ summary):", inputData); // Log data parsée
    } catch (parseError) {
        console.error("Failed to parse request body:", parseError);
        // Retourner au format Netlify Functions
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Invalid JSON body." }),
            headers: { 'Content-Type': 'application/json' }
        };
    }

    const { keywords, genre, style, tone, details } = inputData || {};

    if (!keywords || !genre || !style || !tone) {
        console.error("Missing required input fields:", { keywords, genre, style, tone });
        // Retourner au format Netlify Functions
        return {
            statusCode: 400,
            body: JSON.stringify({ error: "Missing required input fields." }),
            headers: { 'Content-Type': 'application/json' }
        };
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

        // MODIFICATION : Retourner au format Netlify Functions
        return {
            statusCode: 200,
            body: JSON.stringify({ outline: parsedOutline }),
            headers: { 'Content-Type': 'application/json' }
        };

    } catch (error) {
        console.error("Error calling Google AI API (outline w/ summary):", error);
        let errorMessage = `API call failed: ${error.message}`;
        let statusCode = 500;
         if (error.response && error.response.promptFeedback && error.response.promptFeedback.blockReason) { errorMessage = `Blocage Google : ${error.response.promptFeedback.blockReason}`; statusCode = 400; }
         else if (error.message?.includes('API key not valid')) { errorMessage = "Clé API invalide."; statusCode = 500; }
         else if (error.status === 404) { errorMessage = `Modèle non trouvé: ${error.message}`; statusCode = 404; }
         // Gérer spécifiquement l'erreur 429
         else if (error.status === 429 || error.message?.includes('429 Too Many Requests')) { errorMessage = `Quota API dépassé. Veuillez réessayer plus tard ou vérifier votre plan Google AI.`; statusCode = 429; }
         else if (error.status) { errorMessage = `Erreur API: ${error.message}`; statusCode = error.status; }
        // MODIFICATION : Retourner au format Netlify Functions dans le bloc catch
        return {
            statusCode: statusCode,
            body: JSON.stringify({ error: `Échec génération ossature.`, details: errorMessage }),
            headers: { 'Content-Type': 'application/json' }
        };
    }
}