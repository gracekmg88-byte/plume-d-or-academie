// Robots des moteurs de recherche et outils d'aperçu de liens (signature du navigateur).
// Sert à ne pas leur montrer les messages d'accueil (vie privée, invitation à l'appli) : ils ouvrent
// chaque page comme un tout premier visiteur, et une fenêtre par-dessus le contenu peut faire croire
// à Google que la page est vide (« soft 404 »). Le contenu de la page, lui, reste identique pour tous.
// « bot/ » (avec la version, ex. Googlebot/2.1) et non « bot » seul : certains vrais téléphones
// s'appellent « CUBOT … » et ne doivent pas être pris pour des robots.
const BOT_RE =
  /bot\/|crawler|spider|crawling|slurp|bingpreview|mediapartners|adsbot|google-inspectiontool|googleother|chrome-lighthouse|facebookexternalhit|whatsapp\/|embedly|quora link preview|pinterest\/|yandex|baiduspider|petalbot|semrush|ahrefs/i;

export function isSearchBot(userAgent: string = typeof navigator !== "undefined" ? navigator.userAgent : ""): boolean {
  return BOT_RE.test(userAgent || "");
}
