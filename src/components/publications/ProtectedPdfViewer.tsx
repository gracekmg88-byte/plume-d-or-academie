import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { Lock, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, AlertCircle, RefreshCw, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCachedPdfBlobUrl } from "@/lib/pdf-cache";

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface ProtectedPdfViewerProps {
  fileUrl: string;
  title: string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
}

const FULLSCREEN_PREF_PREFIX = "pdfViewer:fullscreen:";
const FULLSCREEN_AUTO_DISABLED_PREFIX = "pdfViewer:fullscreenAutoDisabled:";
const PAGE_PREF_PREFIX = "pdfViewer:page:";
const ZOOM_PREF_PREFIX = "pdfViewer:zoom:";
const SCROLL_PREF_PREFIX = "pdfViewer:scroll:";

// Zoom : 100 % = page ajustée à la largeur ; on peut agrandir jusqu'à 400 %.
const MAX_ZOOM = 4;
// Pendant le pincement, on tolère une légère réduction sous 100 % (effet élastique), corrigée au relâchement.
const PINCH_UNDERSHOOT = 0.85;
// Taille maximale d'un canvas : au-delà, certains téléphones Android affichent une page blanche.
const MAX_CANVAS_PIXELS = 12_000_000;
const DOUBLE_TAP_MS = 320;
// Glissement horizontal pour tourner les pages.
const SWIPE_MIN_PX = 60;
const SWIPE_OUT_MS = 180;
const SWIPE_IN_MS = 240;
const SWIPE_BACK_MS = 200;

type Layer = { id: number; scale: number };
type View = { dx: number; dy: number; r: number };
type Gesture = { d0: number; m0: { x: number; y: number }; base: View; L: number; T: number };
const IDENTITY: View = { dx: 0, dy: 0, r: 1 };

export function ProtectedPdfViewer({ fileUrl, title, initialPage, onPageChange }: ProtectedPdfViewerProps) {
  const prefKey = useMemo(() => `${FULLSCREEN_PREF_PREFIX}${fileUrl}`, [fileUrl]);
  const autoDisabledKey = useMemo(() => `${FULLSCREEN_AUTO_DISABLED_PREFIX}${fileUrl}`, [fileUrl]);
  const pageKey = useMemo(() => `${PAGE_PREF_PREFIX}${fileUrl}`, [fileUrl]);
  const zoomKey = useMemo(() => `${ZOOM_PREF_PREFIX}${fileUrl}`, [fileUrl]);
  const scrollKey = useMemo(() => `${SCROLL_PREF_PREFIX}${fileUrl}`, [fileUrl]);

  // Read locally-saved zoom (per document)
  const initialStoredZoom = useMemo(() => {
    try {
      const raw = localStorage.getItem(zoomKey);
      const n = raw ? parseFloat(raw) : NaN;
      if (!Number.isNaN(n) && n >= 0.3 && n <= 10) return n;
    } catch { /* ignore */ }
    return null;
  }, [zoomKey]);

  // Read locally-saved page as a fallback (works offline / unlogged / reload)
  const initialResolvedPage = useMemo(() => {
    if (initialPage && initialPage > 1) return initialPage;
    try {
      const stored = localStorage.getItem(pageKey);
      const n = stored ? parseInt(stored, 10) : NaN;
      if (!Number.isNaN(n) && n > 1) return n;
    } catch { /* ignore */ }
    return 1;
  }, [initialPage, pageKey]);

  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(initialResolvedPage);
  // Rendu « double tampon » : la page affichée (front) reste visible pendant que la même page est
  // redessinée nette à la nouvelle échelle dans un calque caché ; on bascule quand il est prêt.
  const [layers, setLayers] = useState<Layer[]>(() => [{ id: 0, scale: initialStoredZoom ?? 1 }]);
  const [frontId, setFrontId] = useState(0);
  const front = layers.find((l) => l.id === frontId) ?? layers[0];
  const scale = front.scale;
  const [userZoomed, setUserZoomed] = useState(initialStoredZoom !== null);
  const [fitScale, setFitScale] = useState<number | null>(null);
  const [nativeSize, setNativeSize] = useState<{ w: number; h: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [needsFullscreenGesture, setNeedsFullscreenGesture] = useState(false);
  const [autoFullscreenDisabled, setAutoFullscreenDisabled] = useState<boolean>(() => {
    try { return localStorage.getItem(`${FULLSCREEN_AUTO_DISABLED_PREFIX}${fileUrl}`) === "1"; }
    catch { return false; }
  });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const pageNativeWidthRef = useRef<number | null>(null);
  // Zoom tactile : état courant du geste, sans re-rendu React à chaque mouvement de doigt.
  const frontElRef = useRef<HTMLDivElement | null>(null);
  const zoomLabelRef = useRef<HTMLSpanElement | null>(null);
  const viewRef = useRef<View>(IDENTITY);
  const gestureRef = useRef<Gesture | null>(null);
  const pendingReadyRef = useRef<number | null>(null);
  const anchorRef = useRef<{ left: number; top: number } | null>(null);
  const layerSeqRef = useRef(0);
  const frontIdRef = useRef(frontId);
  frontIdRef.current = frontId;
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  const fitRef = useRef(fitScale);
  fitRef.current = fitScale;
  const userZoomedRef = useRef(userZoomed);
  userZoomedRef.current = userZoomed;
  // Glissement pour tourner les pages : enveloppe déplacée sous le doigt (indépendante du zoom).
  const swipeElRef = useRef<HTMLDivElement | null>(null);
  const swipeBusyRef = useRef(false);
  const slideInRef = useRef<{ dir: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const numPagesRef = useRef(numPages);
  numPagesRef.current = numPages;
  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;
  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;
  // Pending scroll position to restore after the page renders (read once on mount)
  const pendingScrollRef = useRef<{ top: number; left: number } | null>((() => {
    try {
      const raw = localStorage.getItem(`${SCROLL_PREF_PREFIX}${fileUrl}`);
      if (!raw) return null;
      const [t, l] = raw.split("|").map((x) => parseInt(x, 10));
      if (Number.isFinite(t) && Number.isFinite(l)) return { top: t, left: l };
    } catch { /* ignore */ }
    return null;
  })());
  // Always render with the direct URL to avoid a remount/reload when a cached blob is found.
  // Warm the HTTP/Cache Storage cache in the background so subsequent opens are faster, but
  // never swap the URL after the first paint — that causes the visible "double load".
  const resolvedUrl = fileUrl;

  useEffect(() => {
    if (typeof caches === "undefined") return;
    getCachedPdfBlobUrl(fileUrl).catch(() => {});
  }, [fileUrl]);

  const documentSource = useMemo(() => ({ url: resolvedUrl, withCredentials: false }), [resolvedUrl]);

  // pdf.js options: enable range/stream so pages render before the full file is downloaded,
  // and ship cMap + standard fonts from the CDN to avoid missing-glyph warnings/retries.
  const pdfOptions = useMemo(() => ({
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
    disableAutoFetch: true,   // don't prefetch the entire PDF up front
    disableStream: false,     // allow chunked streaming as the user navigates
    isEvalSupported: false,
  }), []);

  // Render at the device's actual pixel ratio (capped at 3) so text stays crisp,
  // especially on high-DPI phones where the previous 1.25 cap caused visible blur.
  const canvasDpr = useMemo(
    () => Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 3),
    [],
  );

  // À fort zoom, réduit la densité de pixels pour que le canvas reste sous la limite des téléphones.
  const dprForScale = useCallback((s: number) => {
    if (!nativeSize) return canvasDpr;
    const area = nativeSize.w * s * nativeSize.h * s;
    if (area <= 0) return canvasDpr;
    return Math.max(1, Math.min(canvasDpr, Math.sqrt(MAX_CANVAS_PIXELS / area)));
  }, [canvasDpr, nativeSize]);

  const minScale = useCallback(() => fitRef.current ?? 0.3, []);
  const maxScale = useCallback(() => (fitRef.current ?? 1) * MAX_ZOOM, []);
  const formatZoom = useCallback((s: number) => `${Math.round((s / (fitRef.current || s)) * 100)}%`, []);

  // Applique le zoom visuel en cours (transformation GPU) à la page affichée.
  const applyView = useCallback((v: View) => {
    viewRef.current = v;
    const el = frontElRef.current;
    if (el) {
      const idle = v.r === 1 && v.dx === 0 && v.dy === 0;
      el.style.transform = idle ? "" : `translate3d(${v.dx}px, ${v.dy}px, 0) scale(${v.r})`;
      if (idle) el.style.willChange = "";
    }
    if (zoomLabelRef.current) zoomLabelRef.current.textContent = formatZoom(scaleRef.current * v.r);
  }, [formatZoom]);

  // Changement d'échelle direct (ajustement à la largeur, rotation…) : abandonne tout zoom en cours.
  const setScale = useCallback((update: number | ((s: number) => number)) => {
    const current = scaleRef.current;
    const s = typeof update === "function" ? update(current) : update;
    if (Math.abs(s - current) < 1e-3) return; // rien à changer : ne pas interrompre un zoom en cours
    pendingReadyRef.current = null;
    applyView(IDENTITY);
    setLayers((ls) => {
      const f = ls.find((l) => l.id === frontIdRef.current) ?? ls[0];
      return [{ ...f, scale: s }];
    });
  }, [applyView]);

  // Calcule la vue pour un geste : le point d0/m0 du début reste sous les doigts (zoom autour du pincement).
  const viewFor = useCallback((g: Gesture, q: number, m: { x: number; y: number }): View => {
    const s0 = scaleRef.current;
    const lo = (minScale() * PINCH_UNDERSHOOT) / s0;
    const hi = maxScale() / s0;
    const r = Math.min(hi, Math.max(lo, g.base.r * q));
    const k = r / g.base.r;
    return {
      r,
      dx: m.x - g.L + k * (g.L + g.base.dx - g.m0.x),
      dy: m.y - g.T + k * (g.T + g.base.dy - g.m0.y),
    };
  }, [minScale, maxScale]);

  const beginGesture = useCallback((m: { x: number; y: number }, d0 = 1): Gesture | null => {
    const el = frontElRef.current;
    if (!el) return null;
    const base = { ...viewRef.current };
    const rect = el.getBoundingClientRect();
    el.style.transition = "";
    el.style.willChange = "transform";
    return { d0: d0 || 1, m0: m, base, L: rect.left - base.dx, T: rect.top - base.dy };
  }, []);

  // Fin de geste : redessine la page nette à la nouvelle échelle (dans un calque caché).
  const commitView = useCallback(() => {
    pendingReadyRef.current = null;
    const v = viewRef.current;
    const s0 = scaleRef.current;
    let target = Math.min(maxScale(), Math.max(minScale(), s0 * v.r));
    const fit = fitRef.current;
    const atFit = fit ? Math.abs(target - fit) / fit < 0.03 : false;
    if (fit && atFit) target = fit;
    if (Math.abs(target - s0) < 1e-3) {
      // Aucun changement d'échelle : un éventuel déplacement à deux doigts devient un défilement.
      const area = scrollAreaRef.current;
      if (area && (v.dx || v.dy)) {
        area.scrollLeft -= v.dx;
        area.scrollTop -= v.dy;
      }
      applyView(IDENTITY);
      setLayers((ls) => ls.filter((l) => l.id === frontIdRef.current));
      return;
    }
    setUserZoomed(!atFit);
    userZoomedRef.current = !atFit;
    const id = ++layerSeqRef.current;
    setLayers((ls) => {
      const f = ls.find((l) => l.id === frontIdRef.current) ?? ls[0];
      return [f, { id, scale: target }];
    });
  }, [applyView, minScale, maxScale]);

  // Le calque caché est prêt : il remplace la page affichée, à la même position à l'écran.
  const promoteLayer = useCallback((id: number) => {
    const el = frontElRef.current;
    const rect = el?.getBoundingClientRect();
    anchorRef.current = rect ? { left: rect.left, top: rect.top } : null;
    viewRef.current = IDENTITY;
    setFrontId(id);
    setLayers((ls) => ls.filter((l) => l.id === id));
  }, []);

  const onLayerRendered = useCallback((id: number) => {
    if (id === frontIdRef.current) return;
    if (gestureRef.current) {
      pendingReadyRef.current = id; // ne pas basculer au milieu d'un geste
      return;
    }
    promoteLayer(id);
  }, [promoteLayer]);

  useLayoutEffect(() => {
    const el = frontElRef.current;
    const area = scrollAreaRef.current;
    if (el) {
      el.style.transform = "";
      el.style.transition = "";
      el.style.willChange = "";
    }
    const anchor = anchorRef.current;
    anchorRef.current = null;
    if (el && area && anchor) {
      const rect = el.getBoundingClientRect();
      area.scrollLeft += rect.left - anchor.left;
      area.scrollTop += rect.top - anchor.top;
    }
    if (zoomLabelRef.current) zoomLabelRef.current.textContent = formatZoom(scaleRef.current);
  }, [frontId, scale, fitScale, formatZoom]);

  // Zoom animé vers une échelle donnée, autour d'un point de l'écran (double-tapotement, boutons).
  const animateZoomTo = useCallback((target: number, x: number, y: number) => {
    const el = frontElRef.current;
    const g = beginGesture({ x, y });
    if (!el || !g) return;
    const q = target / (scaleRef.current * g.base.r);
    el.style.transition = "transform 180ms ease-out";
    applyView(viewFor(g, q, { x, y }));
    window.setTimeout(() => {
      el.style.transition = "";
      commitView();
    }, 190);
  }, [applyView, beginGesture, commitView, viewFor]);

  const setSwipeStyle = useCallback((x: number, opacity: number, transition: string) => {
    const el = swipeElRef.current;
    if (!el) return;
    el.style.transition = transition;
    el.style.transform = x === 0 ? "" : `translate3d(${x}px, 0, 0)`;
    el.style.opacity = opacity === 1 ? "" : String(opacity);
  }, []);

  // Nouvelle page dessinée après un glissement : elle entre par le côté opposé au geste.
  const finishSlideIn = useCallback(() => {
    const pending = slideInRef.current;
    if (!pending) return;
    slideInRef.current = null;
    clearTimeout(pending.timer);
    const el = swipeElRef.current;
    if (el) {
      setSwipeStyle(-pending.dir * Math.min(120, el.clientWidth * 0.3), 0, "none");
      void el.offsetWidth; // applique la position de départ avant l'animation
      setSwipeStyle(0, 1, `transform ${SWIPE_IN_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity ${SWIPE_IN_MS}ms ease-out`);
    }
    window.setTimeout(() => { swipeBusyRef.current = false; }, SWIPE_IN_MS);
  }, [setSwipeStyle]);

  const viewCenter = useCallback(() => {
    const rect = scrollAreaRef.current?.getBoundingClientRect();
    return rect ? { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 } : { x: 0, y: 0 };
  }, []);

  // Gestes tactiles : pincement à deux doigts, double-tapotement ; le glissement à un doigt reste natif.
  useEffect(() => {
    const area = scrollAreaRef.current;
    if (!area) return;
    const dist = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    const mid = (a: Touch, b: Touch) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
    let tap: { x: number; y: number; t: number; moved: boolean } | null = null;
    let lastTap: { x: number; y: number; t: number } | null = null;

    const startPinch = (e: TouchEvent) => {
      const [a, b] = [e.touches[0], e.touches[1]];
      gestureRef.current = beginGesture(mid(a, b), dist(a, b));
    };
    const onStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        if (e.cancelable) e.preventDefault();
        tap = null;
        lastTap = null;
        startPinch(e);
      } else if (e.touches.length === 1) {
        const t = e.touches[0];
        tap = { x: t.clientX, y: t.clientY, t: performance.now(), moved: false };
      }
    };
    const onMove = (e: TouchEvent) => {
      const g = gestureRef.current;
      if (g && e.touches.length >= 2) {
        if (e.cancelable) e.preventDefault();
        const [a, b] = [e.touches[0], e.touches[1]];
        applyView(viewFor(g, dist(a, b) / g.d0, mid(a, b)));
        return;
      }
      if (tap && e.touches.length === 1) {
        const t = e.touches[0];
        if (Math.hypot(t.clientX - tap.x, t.clientY - tap.y) > 10) tap.moved = true;
      }
    };
    const onEnd = (e: TouchEvent) => {
      if (gestureRef.current) {
        if (e.touches.length >= 2) { startPinch(e); return; }
        gestureRef.current = null;
        tap = null;
        commitView();
        return;
      }
      if (tap && !tap.moved && e.touches.length === 0 && performance.now() - tap.t < 300) {
        const now = performance.now();
        if (lastTap && now - lastTap.t < DOUBLE_TAP_MS && Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) < 40) {
          if (e.cancelable) e.preventDefault();
          lastTap = null;
          const s = scaleRef.current * viewRef.current.r;
          const fit = fitRef.current ?? s;
          animateZoomTo(s / fit < 1.5 ? fit * 2 : fit, tap.x, tap.y);
        } else {
          lastTap = { x: tap.x, y: tap.y, t: now };
        }
      }
      tap = null;
    };

    // Ordinateur : pincement du pavé tactile (ou Ctrl + molette) autour du pointeur.
    let wheelGesture: { g: Gesture; q: number } | null = null;
    let wheelTimer: ReturnType<typeof setTimeout> | null = null;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const m = { x: e.clientX, y: e.clientY };
      if (!wheelGesture) {
        const g = beginGesture(m);
        if (!g) return;
        wheelGesture = { g, q: 1 };
        gestureRef.current = g;
      }
      wheelGesture.q *= Math.exp(-e.deltaY * 0.01);
      applyView(viewFor(wheelGesture.g, wheelGesture.q, m));
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        wheelGesture = null;
        gestureRef.current = null;
        commitView();
      }, 200);
    };

    area.addEventListener("touchstart", onStart, { passive: false });
    area.addEventListener("touchmove", onMove, { passive: false });
    area.addEventListener("touchend", onEnd, { passive: false });
    area.addEventListener("touchcancel", onEnd, { passive: false });
    area.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      area.removeEventListener("touchstart", onStart);
      area.removeEventListener("touchmove", onMove);
      area.removeEventListener("touchend", onEnd);
      area.removeEventListener("touchcancel", onEnd);
      area.removeEventListener("wheel", onWheel);
      if (wheelTimer) clearTimeout(wheelTimer);
    };
  }, [animateZoomTo, applyView, beginGesture, commitView, viewFor]);

  // Tourner les pages d'un glissement horizontal à un doigt (comme une liseuse). Écouteurs séparés :
  // le zoom à deux doigts et le double-tapotement ci-dessus ne sont pas modifiés. Dès qu'un deuxième
  // doigt touche l'écran, le glissement est abandonné et le zoom garde la main.
  useEffect(() => {
    const area = scrollAreaRef.current;
    if (!area) return;
    type Swipe = {
      x0: number; y0: number; t0: number;
      lock: "h" | "v" | null;
      // Page agrandie : on ne tourne la page que si le document est déjà au bord dans le sens du geste.
      edgeNext: boolean; edgePrev: boolean;
      dx: number; blocked: boolean;
    };
    let s: Swipe | null = null;
    let outTimer: ReturnType<typeof setTimeout> | null = null;

    const springBack = () => setSwipeStyle(0, 1, `transform ${SWIPE_BACK_MS}ms ease-out, opacity ${SWIPE_BACK_MS}ms ease-out`);
    const cancel = () => {
      if (s?.lock === "h") springBack();
      s = null;
    };

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || gestureRef.current || swipeBusyRef.current) { cancel(); return; }
      const t = e.touches[0];
      const maxLeft = area.scrollWidth - area.clientWidth;
      const overflow = maxLeft > 2;
      s = {
        x0: t.clientX, y0: t.clientY, t0: performance.now(), lock: null,
        edgeNext: !overflow || area.scrollLeft >= maxLeft - 2,
        edgePrev: !overflow || area.scrollLeft <= 2,
        dx: 0, blocked: false,
      };
    };
    const onMove = (e: TouchEvent) => {
      if (!s) return;
      if (e.touches.length !== 1 || gestureRef.current) { cancel(); return; }
      const t = e.touches[0];
      const dx = t.clientX - s.x0;
      const dy = t.clientY - s.y0;
      if (s.lock === null) {
        if (Math.hypot(dx, dy) < 10) return;
        const horizontal = Math.abs(dx) > Math.abs(dy) * 1.2;
        const allowed = dx < 0 ? s.edgeNext : s.edgePrev;
        s.lock = horizontal && allowed ? "h" : "v";
      }
      if (s.lock !== "h") return;
      if (e.cancelable) e.preventDefault();
      const page = currentPageRef.current;
      s.blocked = (dx < 0 && page >= numPagesRef.current) || (dx > 0 && page <= 1);
      s.dx = dx;
      // En première / dernière page : la page résiste sous le doigt puis revient.
      setSwipeStyle(s.blocked ? dx * 0.25 : dx, 1, "none");
    };
    const onEnd = (e: TouchEvent) => {
      if (!s) return;
      const cur = s;
      s = null;
      if (cur.lock !== "h") return;
      if (e.touches.length > 0) { springBack(); return; }
      const dt = Math.max(1, performance.now() - cur.t0);
      const dist = Math.abs(cur.dx);
      const commit = !cur.blocked && (dist > SWIPE_MIN_PX || (dist > 25 && dist / dt > 0.4));
      if (!commit) { springBack(); return; }
      // Validé : la page sort du côté du geste, la suivante entre par l'autre côté une fois dessinée.
      const dir = cur.dx < 0 ? -1 : 1;
      swipeBusyRef.current = true;
      setSwipeStyle(dir * area.clientWidth, 0, `transform ${SWIPE_OUT_MS}ms ease-in, opacity ${SWIPE_OUT_MS}ms ease-in`);
      outTimer = setTimeout(() => {
        outTimer = null;
        slideInRef.current = { dir, timer: setTimeout(finishSlideIn, 900) };
        setCurrentPage((p) => {
          const next = dir < 0 ? Math.min(numPagesRef.current, p + 1) : Math.max(1, p - 1);
          onPageChangeRef.current?.(next);
          return next;
        });
      }, SWIPE_OUT_MS);
    };

    area.addEventListener("touchstart", onStart, { passive: true });
    area.addEventListener("touchmove", onMove, { passive: false });
    area.addEventListener("touchend", onEnd, { passive: true });
    area.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      area.removeEventListener("touchstart", onStart);
      area.removeEventListener("touchmove", onMove);
      area.removeEventListener("touchend", onEnd);
      area.removeEventListener("touchcancel", onEnd);
      if (outTimer) clearTimeout(outTimer);
      if (slideInRef.current) clearTimeout(slideInRef.current.timer);
      slideInRef.current = null;
      swipeBusyRef.current = false;
    };
  }, [finishSlideIn, setSwipeStyle]);

  // Compute a "fit-to-width" scale based on the visible container and the page's
  // native width. Re-runs on resize, fullscreen toggle, and orientation changes.
  const recomputeFitScale = useCallback(() => {
    const el = scrollAreaRef.current;
    const native = pageNativeWidthRef.current;
    if (!el || !native) return;
    // Leave a small horizontal padding so the page doesn't touch the edges.
    const available = Math.max(0, el.clientWidth - 16);
    if (available <= 0) return;
    const next = Math.max(0.3, Math.min(2.5, available / native));
    // Pendant un zoom, une barre de défilement qui apparaît change à peine la largeur : on ignore ce
    // micro-écart pour ne pas recalculer (et interrompre) le zoom.
    if (fitRef.current && Math.abs(next - fitRef.current) / fitRef.current < 0.02 && userZoomedRef.current) return;
    setFitScale(next);
    fitRef.current = next;
    // 100 % = ajusté à la largeur ; un zoom enregistré reste entre 100 % et 400 %.
    setScale((prev) => (userZoomedRef.current ? Math.min(next * MAX_ZOOM, Math.max(next, prev)) : next));
  }, [setScale]);

  useEffect(() => {
    const onResize = () => recomputeFitScale();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [recomputeFitScale]);

  useEffect(() => { recomputeFitScale(); }, [isFullscreen, recomputeFitScale]);

  // Persist current page locally on every change
  useEffect(() => {
    try {
      if (currentPage > 1) localStorage.setItem(pageKey, String(currentPage));
      else localStorage.removeItem(pageKey);
    } catch { /* ignore */ }
  }, [currentPage, pageKey]);

  // Persist zoom level (only when the user explicitly zoomed, not fit-to-width)
  useEffect(() => {
    try {
      if (userZoomed) localStorage.setItem(zoomKey, String(scale));
      else localStorage.removeItem(zoomKey);
    } catch { /* ignore */ }
  }, [scale, userZoomed, zoomKey]);

  // Persist scroll position (debounced) and restore once content is ready
  useEffect(() => {
    const el = scrollAreaRef.current;
    if (!el) return;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        try {
          const top = el.scrollTop;
          const left = el.scrollLeft;
          if (top > 0 || left > 0) localStorage.setItem(scrollKey, `${top}|${left}`);
          else localStorage.removeItem(scrollKey);
        } catch { /* ignore */ }
      }, 300);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (saveTimer) clearTimeout(saveTimer);
    };
  }, [scrollKey]);

  // Restore saved scroll position only once on initial viewer mount.
  useEffect(() => {
    if (loading || currentPage !== initialResolvedPage) return;
    const target = pendingScrollRef.current;
    if (!target) return;
    const el = scrollAreaRef.current;
    if (!el) return;
    // Wait two frames so the canvas has been laid out at its full size.
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        el.scrollTo({ top: target.top, left: target.left, behavior: "auto" });
        pendingScrollRef.current = null;
      });
    });
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2); };
  }, [currentPage, initialResolvedPage, loading]);


  // Sync with initialPage when it changes (e.g. from DB fetch)
  useEffect(() => {
    if (initialPage && initialPage > 1) {
      setCurrentPage(initialPage);
    }
  }, [initialPage]);

  // Changement de page : abandonne un redessin en attente de l'ancienne page et repart du haut
  // de la nouvelle page (le niveau de zoom est conservé).
  const shownPageRef = useRef(currentPage);
  useEffect(() => {
    pendingReadyRef.current = null;
    setLayers((ls) => (ls.length > 1 ? ls.filter((l) => l.id === frontIdRef.current) : ls));
    applyView(IDENTITY);
    if (shownPageRef.current !== currentPage) {
      shownPageRef.current = currentPage;
      scrollAreaRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [currentPage, applyView]);

  const toggleAutoFullscreen = useCallback(() => {
    setAutoFullscreenDisabled((prev) => {
      const next = !prev;
      try {
        if (next) {
          localStorage.setItem(autoDisabledKey, "1");
          // Also clear any stored "should restore" flag so it doesn't fire next time
          localStorage.removeItem(prefKey);
        } else {
          localStorage.removeItem(autoDisabledKey);
        }
      } catch { /* ignore */ }
      if (next) setNeedsFullscreenGesture(false);
      return next;
    });
  }, [autoDisabledKey, prefKey]);

  // Track native fullscreen state (handles ESC key) & persist preference per document
  useEffect(() => {
    const handler = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      try {
        if (active) localStorage.setItem(prefKey, "1");
        else localStorage.removeItem(prefKey);
      } catch {
        // ignore storage errors
      }
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [prefKey]);

  const enterFullscreen = useCallback(async () => {
    if (document.fullscreenElement || !containerRef.current?.requestFullscreen) return false;
    try {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
      setNeedsFullscreenGesture(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Auto-restore fullscreen preference for this document once loaded
  useEffect(() => {
    if (loading || autoFullscreenDisabled) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(prefKey);
    } catch {
      stored = null;
    }
    if (stored !== "1" || document.fullscreenElement) return;
    enterFullscreen().then((ok) => {
      if (!ok) setNeedsFullscreenGesture(true);
    });
  }, [loading, prefKey, enterFullscreen, autoFullscreenDisabled]);

  // If the browser blocked auto fullscreen (needs gesture), retry on first tap in the viewer
  useEffect(() => {
    if (!needsFullscreenGesture) return;
    const el = containerRef.current;
    if (!el) return;
    const handler = () => { enterFullscreen(); };
    el.addEventListener("pointerdown", handler, { once: true });
    return () => el.removeEventListener("pointerdown", handler);
  }, [needsFullscreenGesture, enterFullscreen]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback(() => {
    setError(true);
    setLoading(false);
  }, []);

  const goToPrev = () => setCurrentPage((p) => { const next = Math.max(1, p - 1); onPageChange?.(next); return next; });
  const goToNext = () => setCurrentPage((p) => { const next = Math.min(numPages, p + 1); onPageChange?.(next); return next; });
  const zoomIn = () => { const c = viewCenter(); animateZoomTo(Math.min(maxScale(), scale * 1.25), c.x, c.y); };
  const zoomOut = () => { const c = viewCenter(); animateZoomTo(Math.max(minScale(), scale / 1.25), c.x, c.y); };
  const resetZoom = () => {
    if (!fitScale) return;
    const c = viewCenter();
    animateZoomTo(fitScale, c.x, c.y);
  };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const ok = await enterFullscreen();
        if (!ok) setIsFullscreen((v) => !v);
        try { localStorage.setItem(prefKey, "1"); } catch { /* ignore */ }
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
        try { localStorage.removeItem(prefKey); } catch { /* ignore */ }
      }
    } catch {
      setIsFullscreen((v) => !v);
    }
  };

  const retry = () => {
    setError(false);
    setLoading(true);
  };

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-muted p-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive/60" />
        <p className="text-muted-foreground mb-2">Impossible de charger le document.</p>
        <p className="text-xs text-muted-foreground mb-4">Vérifiez votre connexion et réessayez.</p>
        <Button variant="outline" onClick={retry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Réessayer
        </Button>
      </div>
    );
  }

  const atMin = fitScale !== null && scale <= fitScale + 1e-3;
  const atMax = fitScale !== null && scale >= fitScale * MAX_ZOOM - 1e-3;

  return (
    <div
      ref={containerRef}
      className={cn(
        "rounded-xl overflow-hidden border border-border bg-muted relative select-none min-w-0 max-w-full",
        isFullscreen && "fixed inset-0 z-[100] rounded-none border-0",
      )}
      style={{
        WebkitUserSelect: "none",
        MozUserSelect: "none" as any,
        msUserSelect: "none" as any,
        userSelect: "none",
        WebkitTouchCallout: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 bg-card border-b border-border px-3 py-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={goToPrev} disabled={currentPage <= 1} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[70px] text-center">
            {currentPage} / {numPages || "…"}
          </span>
          <Button variant="ghost" size="icon" onClick={goToNext} disabled={currentPage >= numPages} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          {/* Boutons secondaires : sur téléphone, on zoome en pinçant ou en tapotant deux fois. */}
          <Button variant="ghost" size="icon" onClick={zoomOut} disabled={atMin} className="hidden md:inline-flex h-8 w-8" aria-label="Réduire">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <button
            type="button"
            onClick={resetZoom}
            className="text-xs text-muted-foreground min-w-[44px] text-center hover:text-foreground transition-colors"
            title="Ajuster à la largeur (pincez ou tapotez deux fois pour zoomer)"
          >
            <span ref={zoomLabelRef} />
          </button>
          <Button variant="ghost" size="icon" onClick={zoomIn} disabled={atMax} className="hidden md:inline-flex h-8 w-8" aria-label="Agrandir">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant={isFullscreen ? "secondary" : "default"}
            size="sm"
            onClick={toggleFullscreen}
            className={cn(
              "h-9 gap-1.5 px-3 font-semibold shadow-lg ring-2 ring-primary/40",
              !isFullscreen && "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
            aria-label={isFullscreen ? "Quitter le plein écran" : "Lire en plein écran"}
            title={isFullscreen ? "Quitter le plein écran" : "Lire en plein écran"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="text-xs font-semibold hidden sm:inline">
              {isFullscreen ? "Quitter" : "Lire en plein écran"}
            </span>
            <span className="text-xs font-semibold sm:hidden">
              {isFullscreen ? "Quitter" : "Plein écran"}
            </span>
          </Button>
        </div>
      </div>

      {/* Fullscreen hint — disappears once fullscreen is active */}
      {!isFullscreen && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-3 py-1.5 bg-primary/10 border-b border-primary/20 text-[11px] sm:text-xs text-primary font-medium animate-fade-in">
          <div className="flex items-center gap-1.5">
            <Maximize2 className="h-3 w-3 shrink-0" />
            <span>
              {needsFullscreenGesture
                ? "Touchez le document pour reprendre le plein écran"
                : "Astuce : appuyez sur « Lire en plein écran » pour une meilleure lecture"}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleAutoFullscreen}
            className="underline underline-offset-2 hover:text-primary/80 transition-colors"
            aria-pressed={!autoFullscreenDisabled}
            title="Activer ou désactiver la reprise automatique du plein écran pour ce document"
          >
            {autoFullscreenDisabled
              ? "Réactiver la reprise auto du plein écran"
              : "Désactiver la reprise auto du plein écran"}
          </button>
        </div>
      )}

      {/* PDF Content */}
      <div
        ref={scrollAreaRef}
        className={cn(
          // Pas de justify-center : centrée par mx-auto quand elle est plus étroite, la page zoomée
          // reste entièrement accessible en défilant (sinon sa partie gauche serait hors d'atteinte).
          "overflow-auto flex items-start py-4 px-2 bg-muted/50",
          isFullscreen ? "h-[calc(100dvh-48px)]" : "max-h-[75vh] min-h-[50vh]",
        )}
        // Le glissement à un doigt reste natif (fluide) ; le pincement est géré par le lecteur.
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}
        data-pdf-scroll-area=""
      >
        {loading && (
          <div className="absolute inset-0 z-10 bg-background/85" aria-hidden="true">
            <div className="h-full w-full animate-pulse bg-muted/60" />
          </div>
        )}
        {resolvedUrl && (
        // Enveloppe déplacée pendant le glissement pour tourner les pages (sans effet sur le zoom).
        <div ref={swipeElRef} className="mx-auto" style={{ willChange: "transform" }} data-pdf-swipe="">
        <Document
          key={resolvedUrl}
          file={documentSource}
          options={pdfOptions}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          className="select-none mx-auto relative"
        >
          {layers.map((layer) => {
            const isFront = layer.id === front.id;
            const page = (
              <Page
                key={`page-${currentPage}`}
                pageNumber={currentPage}
                scale={layer.scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                devicePixelRatio={dprForScale(layer.scale)}
                loading={null}
                className="shadow-lg mx-auto"
                onRenderSuccess={() => {
                  onLayerRendered(layer.id);
                  if (isFront) finishSlideIn();
                }}
                onLoadSuccess={(p) => {
                  if (!isFront) return;
                  // page.originalWidth / page.view[2] is the PDF's native point width.
                  const dims = p as unknown as { originalWidth?: number; originalHeight?: number };
                  const w = dims.originalWidth ?? p.view?.[2];
                  const h = dims.originalHeight ?? p.view?.[3];
                  if (w && h && (nativeSize?.w !== w || nativeSize?.h !== h)) setNativeSize({ w, h });
                  if (w && pageNativeWidthRef.current !== w) {
                    pageNativeWidthRef.current = w;
                    recomputeFitScale();
                  }
                }}
              />
            );
            return isFront ? (
              <div key={layer.id} ref={frontElRef} style={{ transformOrigin: "0 0" }} data-pdf-page-layer="front">
                {page}
              </div>
            ) : (
              // Calque de redessin : dessiné hors champ, sans agrandir la zone de défilement.
              <div
                key={layer.id}
                aria-hidden="true"
                style={{ position: "absolute", left: 0, top: 0, width: 0, height: 0, overflow: "hidden", visibility: "hidden" }}
              >
                {page}
              </div>
            );
          })}
        </Document>
        </div>
        )}
      </div>

      {/* Watermark */}
      <div
        className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.08]"
        style={{ zIndex: 10 }}
      >
        <div className="text-4xl font-bold text-foreground rotate-[-30deg] whitespace-nowrap">
          KMG LECTURE
        </div>
      </div>

      {/* Protection badge */}
      <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs text-muted-foreground z-20">
        <Lock className="h-3 w-3" />
        Document protégé
      </div>
    </div>
  );
}
