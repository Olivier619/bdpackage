# Guide d'utilisation du site BD Creator

Ce document explique comment utiliser le site BD Creator pour créer des bandes dessinées assistées par IA, étape par étape.

## Installation et lancement

1.  Assurez-vous d'avoir tous les fichiers (`index.html`, `story_generator.js`) dans le même dossier.
2.  Ouvrez le fichier `index.html` dans un navigateur web moderne (Chrome, Firefox, Edge recommandés).
3.  Aucune installation de serveur n'est requise car l'IA (Transformers.js) s'exécute directement dans votre navigateur.
4.  **Important :** La première fois que vous générez un scénario, le chargement du modèle d'IA peut prendre plusieurs minutes en fonction de votre connexion et de votre ordinateur. Les générations suivantes seront plus rapides. Vérifiez la console du navigateur (F12) pour voir la progression du chargement.

## Fonctionnalités principales

Le site BD Creator vous guide à travers les étapes suivantes :

1.  **Idée & Options :** Définissez votre concept initial (mots-clés, histoire), choisissez le Genre, le Style Visuel cible, et le Ton.
2.  **Génération de Scénario :** L'IA génère un scénario structuré (Titre, Synopsis, Chapitres, Pages, Cases avec descriptions/dialogues) en français.
3.  **Validation du Scénario :** Relisez le scénario généré. Approuvez-le pour passer à l'étape suivante. (Les fonctions de modification/régénération sont prévues mais non implémentées dans cette version).
4.  **Génération de Storyboard :** Une fois le scénario approuvé, générez des suggestions de storyboard (Cadrage, Composition) pour chaque chapitre, case par case.
5.  **Validation du Storyboard :** Approuvez le storyboard pour chaque chapitre.
6.  **Génération de Prompts Midjourney :** Obtenez des prompts optimisés en **anglais** pour Midjourney (v6), basés sur le storyboard approuvé, pour chaque case du chapitre.
7.  **Copie des Prompts :** Copiez facilement les prompts pour les utiliser dans Midjourney.
8.  **Gestion de Session :** Sauvegardez et chargez votre progression (y compris les inputs, le scénario généré, l'état d'approbation) localement dans votre navigateur.

## Comment utiliser le site (Workflow)

1.  **Onglet "1. Idée & Options":**
    *   Remplissez les champs : Idée initiale, Genre, Style Visuel, Ton, Détails optionnels.
    *   Cliquez sur "Générer le Scénario". Patientez pendant le travail de l'IA (le premier chargement est long).
2.  **Onglet "2. Scénario":**
    *   Le scénario généré s'affiche. Lisez-le attentivement.
    *   Si satisfait, cliquez sur "Approuver le Scénario". Cela débloquera l'onglet Storyboard.
3.  **Onglet "3. Storyboard":**
    *   Sélectionnez un chapitre dans le menu déroulant.
    *   Si le storyboard n'a pas encore été généré pour ce chapitre, cliquez sur "Générer Storyboard Chapitre X".
    *   Examinez les suggestions de cadrage et de composition pour chaque case.
    *   Si satisfait, cliquez sur "Approuver Storyboard Chapitre". Cela marquera le chapitre comme approuvé et le rendra disponible dans l'onglet Prompts. Répétez pour chaque chapitre.
4.  **Onglet "4. Prompts":**
    *   Sélectionnez un chapitre dont le storyboard a été **approuvé**.
    *   Si les prompts n'ont pas encore été générés, cliquez sur "Générer Prompts Chapitre X".
    *   Les prompts Midjourney en anglais s'affichent pour chaque case.
    *   Utilisez le bouton "Copier" à côté de chaque prompt.
5.  **Gestion des sessions:**
    *   Utilisez "Sauvegarder la session" pour enregistrer votre travail. Donnez un nom unique.
    *   Utilisez "Charger une session" pour reprendre un travail précédent.
    *   Utilisez "Nouvelle session" pour tout effacer et recommencer.

## Détails techniques

*   **IA Client-Side :** Utilise [Transformers.js](https://github.com/xenova/transformers.js) pour exécuter un modèle de langage (comme `Felladrin/onnx-bloomz-560m-sft-chat`) directement dans le navigateur.
    *   **Avantages :** Gratuit (pas de coût d'API), respect de la vie privée (les données ne quittent pas votre machine pour la génération principale).
    *   **Inconvénients :** Performances dépendantes de l'ordinateur de l'utilisateur, premier chargement long, qualité/cohérence potentiellement inférieure aux grands modèles serveur (GPT-4, Claude), limitations de la mémoire du navigateur pour des scénarios très longs.
*   **Langues :** Génère le scénario et le storyboard en **français**. Génère les prompts Midjourney en **anglais**.
*   **Stockage :** Les sessions sont sauvegardées dans le `localStorage` de votre navigateur. L'espace est limité.

## Limitations connues

*   La qualité et la cohérence de l'IA dépendent fortement du modèle utilisé (`bloomz-560m`) et de la complexité de l'input. Des résultats inattendus ou incomplets sont possibles.
*   Le parsing du texte généré par l'IA pour le structurer (scénario, storyboard) peut échouer si l'IA ne suit pas parfaitement le format demandé.
*   Les fonctions de **modification** et de **régénération** spécifiques (après la génération initiale) ne sont **pas implémentées** dans cette version.
*   La génération peut être lente, surtout sur des machines moins puissantes.
*   Pas de gestion de compte utilisateur centralisée ni de stockage cloud.

## Support

Pour des questions ou des problèmes, veuillez consulter la console de développeur de votre navigateur (F12) pour d'éventuels messages d'erreur détaillés.
