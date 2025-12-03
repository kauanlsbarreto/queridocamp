"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { X, ChevronLeft, ChevronRight } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface ImageModalProps {
  isOpen: boolean
  onClose: () => void
  imageSrc: string
  imageAlt: string
  images?: Array<{ src: string; alt: string }>
  currentIndex?: number
}

const ImageModal = ({ isOpen, onClose, imageSrc, imageAlt, images, currentIndex = 0 }: ImageModalProps) => {
  const [index, setIndex] = useState(currentIndex)

  // Reset index when modal opens with new images
  useEffect(() => {
    if (isOpen) {
      setIndex(currentIndex)
    }
  }, [isOpen, currentIndex])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "ArrowLeft" && images && index > 0) {
        setIndex(index - 1)
      } else if (e.key === "ArrowRight" && images && index < images.length - 1) {
        setIndex(index + 1)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, onClose, images, index])

  // Prevent scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "auto"
    }

    return () => {
      document.body.style.overflow = "auto"
    }
  }, [isOpen])

  const handlePrevious = () => {
    if (images && index > 0) {
      setIndex(index - 1)
    }
  }

  const handleNext = () => {
    if (images && index < images.length - 1) {
      setIndex(index + 1)
    }
  }

  const currentImage = images ? images[index] : { src: imageSrc, alt: imageAlt }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 z-50 bg-black/50 text-white p-2 rounded-full hover:bg-black/80 transition-colors"
            onClick={onClose}
          >
            <X size={24} />
          </button>

          {/* Image container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25 }}
            className="relative max-w-5xl max-h-[80vh] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              <div className="relative w-full h-[70vh]">
                <Image
                  src={currentImage.src || "/placeholder.svg"}
                  alt={currentImage.alt}
                  fill
                  className="object-contain"
                  sizes="(max-width: 768px) 100vw, 80vw"
                  priority
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>

            {/* Navigation buttons (only show if we have multiple images) */}
            {images && images.length > 1 && (
              <>
                <button
                  className={`absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-3 rounded-full hover:bg-black/80 transition-colors ${index === 0 ? "opacity-50 cursor-not-allowed" : "opacity-100"}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handlePrevious()
                  }}
                  disabled={index === 0}
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  className={`absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-3 rounded-full hover:bg-black/80 transition-colors ${index === images.length - 1 ? "opacity-50 cursor-not-allowed" : "opacity-100"}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleNext()
                  }}
                  disabled={index === images.length - 1}
                >
                  <ChevronRight size={24} />
                </button>

                {/* Image counter */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm">
                  {index + 1} / {images.length}
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default ImageModal
