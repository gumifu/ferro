"use client";

import { useEffect, useState, useRef } from "react";
import type { Reflection } from "@/lib/types/reflection";
import { FaTimes } from "react-icons/fa";

interface ReflectionDisplayProps {
  reflection: Reflection | null;
  onDisplayComplete?: () => void;
}

/**
 * Reflection Display Component
 * Shows reflection message in corner, fades in/out, no history
 * See doc/v2-reflection-rules.md for design principles
 */
export function ReflectionDisplay({
  reflection,
  onDisplayComplete,
}: ReflectionDisplayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [displayMessage, setDisplayMessage] = useState<string | null>(null);
  const [displayTone, setDisplayTone] = useState<Reflection["tone"] | null>(
    null
  );
  const fadeOutTimerRef = useRef<NodeJS.Timeout | null>(null);

  const closeReflection = () => {
    if (fadeOutTimerRef.current) {
      clearTimeout(fadeOutTimerRef.current);
      fadeOutTimerRef.current = null;
    }
    setIsVisible(false);
    setTimeout(() => {
      setDisplayMessage(null);
      setDisplayTone(null);
      onDisplayComplete?.();
    }, 500); // Wait for fade out animation
  };

  useEffect(() => {
    if (!reflection) {
      // Fade out existing message
      closeReflection();
      return;
    }

    // Clear any existing timer
    if (fadeOutTimerRef.current) {
      clearTimeout(fadeOutTimerRef.current);
      fadeOutTimerRef.current = null;
    }

    // Set new message
    setDisplayMessage(reflection.message);
    setDisplayTone(reflection.tone);

    // Fade in
    setTimeout(() => setIsVisible(true), 10);

    // Auto fade out after 8 seconds (longer for 3 sentences)
    fadeOutTimerRef.current = setTimeout(() => {
      closeReflection();
    }, 8000);

    return () => {
      if (fadeOutTimerRef.current) {
        clearTimeout(fadeOutTimerRef.current);
        fadeOutTimerRef.current = null;
      }
    };
  }, [reflection]);

  if (!displayMessage) {
    return null;
  }

  // Tone-based color (subtle)
  const toneColors = {
    calm: "text-blue-200",
    neutral: "text-gray-200",
    pulse: "text-purple-200",
    wild: "text-orange-200",
  };

  return (
    <div
      className={`fixed bottom-6 right-6 z-20 max-w-sm transition-opacity duration-500 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      onClick={closeReflection}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Enter") {
          closeReflection();
        }
      }}
      aria-label="Close reflection"
    >
      <div className="bg-black/60 backdrop-blur-sm rounded-lg px-4 py-3 border border-white/10 shadow-lg cursor-pointer hover:bg-black/70 transition-colors relative group">
        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            closeReflection();
          }}
          className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Close"
        >
          <FaTimes className="text-white/60 text-xs" />
        </button>
        <p
          className={`text-sm ${
            toneColors[displayTone || "neutral"]
          } leading-relaxed pr-6`}
        >
          {displayMessage}
        </p>
      </div>
    </div>
  );
}

