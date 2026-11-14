// Adresses inconnues → vraie réponse 404 (les routes de l'application et les fichiers passent).
// Les routes plus précises (livre/, auteur/, publication/, sitemap.xml) sont prioritaires.
// Voir src/seo/edge.ts et public/_routes.json (fichiers statiques exclus des Functions).
export { onCatchAllRequest as onRequest } from "../src/seo/edge";
