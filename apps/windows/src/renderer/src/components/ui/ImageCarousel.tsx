// @ts-nocheck
import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { Button } from '@renderer/components/ui/button'

function normalizeSlides(images, alt) {
  return images.map((image, index) => {
    if (typeof image === 'string') {
      return { key: `slide-${index}`, src: image, alt: `${alt} ${index + 1}` }
    }

    return {
      key: image.id ?? image.key ?? `slide-${index}`,
      src: image.url ?? image.src,
      alt: image.alt ?? `${alt} ${index + 1}`,
    }
  })
}

export function ImageCarousel({
  images,
  alt = 'Photo',
  className,
  imageClassName,
  openOnClick = false,
  renderSlideOverlay,
}) {
  const slides = normalizeSlides(images, alt)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [slides.length, slides[0]?.key])

  if (slides.length === 0) {
    return null
  }

  const currentSlide = slides[index] ?? slides[0]

  function goTo(nextIndex) {
    setIndex((nextIndex + slides.length) % slides.length)
  }

  const image = (
    <img
      src={currentSlide.src}
      alt={currentSlide.alt}
      className={cn('aspect-square w-full object-cover', imageClassName)}
    />
  )

  if (slides.length === 1) {
    return (
      <div
        className={cn(
          'relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-gray-50',
          className,
        )}
      >
        {openOnClick ? (
          <a href={currentSlide.src} target="_blank" rel="noopener noreferrer" className="block">
            {image}
          </a>
        ) : (
          image
        )}
        {renderSlideOverlay?.(currentSlide, 0)}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-[var(--color-border)] bg-gray-50',
        className,
      )}
    >
      {openOnClick ? (
        <a href={currentSlide.src} target="_blank" rel="noopener noreferrer" className="block">
          {image}
        </a>
      ) : (
        image
      )}

      {renderSlideOverlay?.(currentSlide, index)}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => goTo(index - 1)}
        className="absolute left-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-white/90 p-0 shadow-sm"
        aria-label="Previous photo"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => goTo(index + 1)}
        className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full bg-white/90 p-0 shadow-sm"
        aria-label="Next photo"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/50 px-2 py-1">
        {slides.map((slide, slideIndex) => (
          <button
            key={slide.key}
            type="button"
            onClick={() => setIndex(slideIndex)}
            className={cn(
              'h-1.5 w-1.5 rounded-full transition-colors',
              slideIndex === index ? 'bg-white' : 'bg-white/40 hover:bg-white/70',
            )}
            aria-label={`Go to photo ${slideIndex + 1}`}
          />
        ))}
      </div>

      <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 text-xs font-medium text-white">
        {index + 1} / {slides.length}
      </span>
    </div>
  )
}
