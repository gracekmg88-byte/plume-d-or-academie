import { useState, useEffect, useRef, useCallback, memo } from "react";
import { cn } from "@/lib/utils";
import { Book } from "lucide-react";
import { getCachedUri, cacheImage } from "@/lib/image-cache";
import { Capacitor } from "@capacitor/core";

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackIcon?: React.ReactNode;
  placeholderClassName?: string;
  containerClassName?: string;
}

// In-memory cache for loaded image URLs (web only)
const imageCache = new Set<string>();

// Preload an image and cache it
export function preloadImage(url: string): Promise<void> {
  if (imageCache.has(url)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.add(url);
      resolve();
    };
    img.onerror = reject;
    img.src = url;
  });
}

// Preload multiple images
export function preloadImages(urls: string[]): void {
  urls.forEach((url) => {
    if (url) preloadImage(url).catch(() => {});
  });
}

export const CachedImage = memo(function CachedImage({
  src,
  alt,
  fallbackIcon,
  className,
  placeholderClassName,
  containerClassName,
  ...props
}: CachedImageProps) {
  const isNative = Capacitor.isNativePlatform();
  const isCached = imageCache.has(src);
  const [loaded, setLoaded] = useState(isCached);
  const [error, setError] = useState(false);
  const [resolvedSrc, setResolvedSrc] = useState<string>(isCached ? src : "");
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [inView, setInView] = useState(isCached);
  const { fetchPriority, ...imgProps } = props;

  // On native: resolve cached local URI or download & cache
  useEffect(() => {
    if (!isNative || !src) return;
    let cancelled = false;

    (async () => {
      // Try local cache first
      const cached = await getCachedUri(src);
      if (cached && !cancelled) {
        setResolvedSrc(cached);
        setInView(true);
        return;
      }
      // Not cached yet — start download in background, use remote URL for now
      if (!cancelled) {
        setResolvedSrc(src);
        setInView(true);
      }
      // Cache for next time
      cacheImage(src).catch(() => {});
    })();

    return () => { cancelled = true; };
  }, [src, isNative]);

  // Web: lazy load with IntersectionObserver
  useEffect(() => {
    if (isNative) return; // handled above
    if (isCached) {
      setResolvedSrc(src);
      setInView(true);
      return;
    }

    const el = imgRef.current?.parentElement;
    if (!el) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setResolvedSrc(src);
          setInView(true);
          observerRef.current?.disconnect();
        }
      },
      { rootMargin: "400px" }
    );
    observerRef.current.observe(el);

    return () => observerRef.current?.disconnect();
  }, [src, isCached, isNative]);

  const handleLoad = useCallback(() => {
    imageCache.add(src);
    setLoaded(true);
  }, [src]);

  const handleError = useCallback(() => {
    setError(true);
  }, []);

  useEffect(() => {
    if (!imgRef.current || typeof fetchPriority !== "string") return;
    imgRef.current.setAttribute("fetchpriority", fetchPriority);
  }, [fetchPriority, resolvedSrc, inView]);

  const defaultFallback = fallbackIcon || (
    <Book className="h-16 w-16 text-muted-foreground/40" />
  );

  if (error) {
    return (
      <div className={cn("flex items-center justify-center bg-gradient-to-br from-muted to-accent", containerClassName)}>
        {defaultFallback}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      {/* Always show placeholder until image is fully loaded */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-accent transition-opacity duration-300",
          loaded ? "opacity-0 pointer-events-none" : "opacity-100",
          placeholderClassName
        )}
      >
        {defaultFallback}
        {!loaded && (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-background/15 to-transparent shimmer-animation" />
        )}
      </div>
      {!inView && <span ref={imgRef} className="absolute inset-0" aria-hidden />}
      {inView && resolvedSrc && (
        <img
          ref={imgRef}
          src={resolvedSrc}
          alt={alt}
          loading="lazy"
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            "transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
            className
          )}
          {...imgProps}
        />
      )}
    </div>
  );
});
