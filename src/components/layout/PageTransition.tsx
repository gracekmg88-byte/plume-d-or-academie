import { ReactNode } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

interface PageTransitionProps {
  children: ReactNode;
}

/**
 * Transition douce entre les pages : à l'arrivée sur une page, son contenu monte de quelques
 * pixels en apparaissant (titre puis sous-titre légèrement décalés), comme sur les grands sites.
 *
 * - Toutes les pages en profitent, sauf au « retour » (bouton précédent, retour au tableau de
 *   bord) et au premier chargement : la page apparaît alors immobile, à la position quittée.
 * - Seul le chemin compte : un changement de paramètres (?q=, ?page=…) ne rejoue pas l'animation
 *   (sinon le champ de recherche perdrait le focus à chaque lettre).
 * - Désactivée si l'utilisateur a demandé moins d'animations (réglage du téléphone / système).
 */
export function PageTransition({ children }: PageTransitionProps) {
  const location = useLocation();
  const navigationType = useNavigationType();
  const state = location.state as { restoredFromPublication?: boolean; restoreScroll?: boolean } | null;
  const isReturn = navigationType === "POP" || Boolean(state?.restoredFromPublication || state?.restoreScroll);

  return (
    <div key={location.pathname} className={`page-transition-root${isReturn ? "" : " page-transition-enter"}`}>
      {children}
    </div>
  );
}
