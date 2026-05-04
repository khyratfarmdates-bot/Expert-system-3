import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes Arabic text to handle common spelling variations and typos.
 */
export function normalizeArabic(text: string): string {
  if (!text) return "";
  return text
    .trim()
    .toLowerCase()
    // Handle Alif variations
    .replace(/[أإآ]/g, "ا")
    // Handle Taa Marbuta and Ha variations
    .replace(/ة/g, "ه")
    // Handle Yaa variations
    .replace(/[ىي]/g, "ي")
    // Remove extra spaces
    .replace(/\s+/g, " ")
    // Remove punctuation
    .replace(/[^\w\s\u0600-\u06FF]/g, "");
}

/**
 * Simple Levenshtein distance based similarity (0 to 1)
 */
export function calculateSimilarity(s1: string, s2: string): number {
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(s1: string, s2: string): number {
  const costs: number[] = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) {
        costs[j] = j;
      } else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          }
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}
