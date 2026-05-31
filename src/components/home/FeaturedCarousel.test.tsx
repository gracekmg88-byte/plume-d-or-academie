import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FeaturedCarousel } from "./FeaturedCarousel";
import type { FeaturedPublication } from "@/hooks/useFeaturedPublications";

// --- Mocks for browser-only deps used inside the carousel ---
vi.mock("embla-carousel-react", () => {
  const useEmblaCarousel = () => {
    const api = {
      scrollTo: vi.fn(),
      scrollPrev: vi.fn(),
      scrollNext: vi.fn(),
      scrollSnapList: () => [0, 0.5],
      selectedScrollSnap: () => 0,
      on: vi.fn(),
      off: vi.fn(),
      clickAllowed: () => true,
    };
    const ref = (_node: HTMLElement | null) => {};
    return [ref, api];
  };
  return { default: useEmblaCarousel };
});

vi.mock("embla-carousel-autoplay", () => ({
  default: () => ({ stop: vi.fn(), play: vi.fn(), reset: vi.fn() }),
}));

vi.mock("@/components/ui/cached-image", () => ({
  CachedImage: ({ alt }: any) => <img alt={alt} />,
  preloadImages: () => {},
}));

vi.mock("@/lib/route-preload", () => ({ preloadPublicationFlow: () => {} }));
vi.mock("@/hooks/usePublications", () => ({ fetchPublication: () => Promise.resolve({}) }));
vi.mock("@/lib/scroll-restoration", () => ({ saveScrollPosition: () => {} }));

const pubs: FeaturedPublication[] = [
  {
    id: "pub-1",
    title: "Premier document",
    author: "Auteur Un",
    category: "livre",
    cover_image_url: null,
    views_count: 10,
    is_featured: true,
    downloads_count: 0,
    created_at: new Date().toISOString(),
  } as any,
  {
    id: "pub-2",
    title: "Deuxième document",
    author: "Auteur Deux",
    category: "memoire",
    cover_image_url: null,
    views_count: 5,
    is_featured: false,
    downloads_count: 2,
    created_at: new Date().toISOString(),
  } as any,
];

function renderWithRouter(initialEntries: any[] = ["/"]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let captured: ReturnType<typeof useLocation> | null = null;
  const Probe = () => {
    captured = useLocation();
    return null;
  };
  const utils = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route
            path="/"
            element={
              <>
                <FeaturedCarousel publications={pubs} />
                <Probe />
              </>
            }
          />
          <Route path="/publication/:id" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
  return { ...utils, getLocation: () => captured! };
}

describe("FeaturedCarousel", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("ouvre le document au premier clic (mobile)", () => {
    const { getLocation } = renderWithRouter();
    const card = screen.getByText("Premier document").closest("a")!;
    fireEvent.click(card);
    const loc = getLocation();
    expect(loc.pathname).toBe("/publication/pub-1");
    expect((loc.state as any).returnPublicationId).toBe("pub-1");
    expect((loc.state as any).returnTo).toBe("/");
  });

  it("persiste la sélection dans sessionStorage pour restauration robuste (tablette/3G)", () => {
    renderWithRouter();
    fireEvent.click(screen.getByText("Deuxième document").closest("a")!);
    expect(sessionStorage.getItem("carousel:lastFeaturedPickId")).toBe("pub-2");
  });

  it("met en évidence la publication consultée au retour", () => {
    sessionStorage.setItem("carousel:lastFeaturedPickId", "pub-2");
    sessionStorage.setItem("carousel:lastFeaturedPickAt", String(Date.now()));
    renderWithRouter();
    const highlighted = document.querySelector('[data-publication-card-id="pub-2"]');
    expect(highlighted?.getAttribute("data-highlighted")).toBe("true");
    const other = document.querySelector('[data-publication-card-id="pub-1"]');
    expect(other?.getAttribute("data-highlighted")).toBeNull();
  });

  it("met en évidence via location.state.restoredFromPublication", () => {
    renderWithRouter([
      {
        pathname: "/",
        state: { restoredFromPublication: true, returnPublicationId: "pub-1" },
      },
    ]);
    const el = document.querySelector('[data-publication-card-id="pub-1"]');
    expect(el?.getAttribute("data-highlighted")).toBe("true");
  });
});
