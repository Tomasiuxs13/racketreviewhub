import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Camera } from "lucide-react";

// Manifest maps racket slug -> array of image filenames under /user-images/<slug>/
type Manifest = Record<string, string[]>;

let manifestCache: Manifest | null = null;
let manifestPromise: Promise<Manifest> | null = null;

function loadManifest(): Promise<Manifest> {
  if (manifestCache) return Promise.resolve(manifestCache);
  if (!manifestPromise) {
    manifestPromise = fetch("/user-images/manifest.json")
      .then((r) => (r.ok ? r.json() : {}))
      .then((m: Manifest) => {
        manifestCache = m;
        return m;
      })
      .catch(() => ({}) as Manifest);
  }
  return manifestPromise;
}

interface UserPhotoGalleryProps {
  slug: string;
  racketName: string;
}

export function UserPhotoGallery({ slug, racketName }: UserPhotoGalleryProps) {
  const [images, setImages] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    loadManifest().then((m) => {
      if (active) setImages(m[slug] || []);
    });
    return () => {
      active = false;
    };
  }, [slug]);

  // Close lightbox with Escape, navigate with arrows
  useEffect(() => {
    if (lightboxIndex === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowRight")
        setLightboxIndex((i) => (i === null ? null : (i + 1) % images.length));
      if (e.key === "ArrowLeft")
        setLightboxIndex((i) =>
          i === null ? null : (i - 1 + images.length) % images.length,
        );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightboxIndex, images.length]);

  if (images.length === 0) return null;

  const src = (file: string) => `/user-images/${slug}/${file}`;

  return (
    <section className="mb-16" data-testid="user-photo-gallery">
      <div className="flex items-center gap-3 mb-6">
        <Camera className="w-5 h-5 text-primary" />
        <h2 className="font-heading font-bold text-xl sm:text-2xl">
          Real Photos
        </h2>
        <span className="text-sm text-muted-foreground">
          ({images.length})
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {images.map((file, idx) => (
          <button
            key={file}
            type="button"
            onClick={() => setLightboxIndex(idx)}
            className="group relative aspect-square overflow-hidden rounded-xl border border-border/40 bg-muted/20 focus:outline-none focus:ring-2 focus:ring-primary"
            aria-label={`View photo ${idx + 1} of ${racketName}`}
          >
            <img
              src={src(file)}
              alt={`${racketName} — real photo ${idx + 1}`}
              loading="lazy"
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxIndex(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            onClick={() => setLightboxIndex(null)}
            aria-label="Close"
          >
            <X className="w-8 h-8" />
          </button>
          {images.length > 1 && (
            <button
              type="button"
              className="absolute left-2 sm:left-6 text-white/80 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(
                  (lightboxIndex - 1 + images.length) % images.length,
                );
              }}
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-10 h-10" />
            </button>
          )}
          <img
            src={src(images[lightboxIndex])}
            alt={`${racketName} — real photo ${lightboxIndex + 1}`}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
          {images.length > 1 && (
            <button
              type="button"
              className="absolute right-2 sm:right-6 text-white/80 hover:text-white"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((lightboxIndex + 1) % images.length);
              }}
              aria-label="Next photo"
            >
              <ChevronRight className="w-10 h-10" />
            </button>
          )}
          <div className="absolute bottom-4 text-white/70 text-sm">
            {lightboxIndex + 1} / {images.length}
          </div>
        </div>
      )}
    </section>
  );
}
