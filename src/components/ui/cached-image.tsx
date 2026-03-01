import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallbackIcon?: React.ReactNode;
  placeholderClassName?: string;
  containerClassName?: string;
}

// In-memory cache for loaded image URLs
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

export function CachedImage({
  src,
  alt,
  fallbackIcon,
  className,
  placeholderClassName,
  containerClassName,
  ...props
}: CachedImageProps) {
  const isCached = imageCache.has(src);
  const [loaded, setLoaded] = useState(isCached);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [inView, setInView] = useState(isCached);

  // Lazy load with IntersectionObserver
  useEffect(() => {
    if (isCached) {
      setInView(true);
      return;
    }

    const el = imgRef.current?.parentElement;
    if (!el) return;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observerRef.current?.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observerRef.current.observe(el);

    return () => observerRef.current?.disconnect();
  }, [src, isCached]);

  const handleLoad = useCallback(() => {
    imageCache.add(src);
    setLoaded(true);
  }, [src]);

  const handleError = useCallback(() => {
    setError(true);
  }, []);

  if (error) {
    return (
      <div className={cn("flex items-center justify-center bg-gradient-to-br from-muted to-accent", containerClassName)}>
        {fallbackIcon || (
          <div className="text-muted-foreground/30 text-sm">Image non disponible</div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden", containerClassName)}>
      {/* Shimmer placeholder */}
      {!loaded && (
        <div
          className={cn(
            "absolute inset-0 bg-muted animate-pulse",
            placeholderClassName
          )}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-background/20 to-transparent shimmer-animation" />
        </div>
      )}
      {/* Actual image */}
      {inView && (
        <img
          ref={imgRef}
          src={src}
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
          {...props}
        />
      )}
    </div>
  );
}
