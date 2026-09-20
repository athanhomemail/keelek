import React from 'react';

/**
 * High-definition vector SVG flag for Thailand (3:2 aspect ratio).
 * Reliable across all operating systems (Windows, macOS, Linux, iOS, Android).
 */
export function ThaiFlag({ className = "w-6 h-4 inline-block rounded shadow-sm shrink-0" }) {
  return (
    <svg 
      viewBox="0 0 900 600" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="ธงชาติไทย"
    >
      <rect width="900" height="600" fill="#ED1C24" />
      <rect y="100" width="900" height="400" fill="#FFFFFF" />
      <rect y="200" width="900" height="200" fill="#241D4F" />
    </svg>
  );
}

/**
 * High-definition vector SVG flag for Laos (3:2 aspect ratio).
 * Reliable across all operating systems (Windows, macOS, Linux, iOS, Android).
 */
export function LaoFlag({ className = "w-6 h-4 inline-block rounded shadow-sm shrink-0" }) {
  return (
    <svg 
      viewBox="0 0 900 600" 
      className={className} 
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="ธงชาติลาว"
    >
      <rect width="900" height="600" fill="#CE1126" />
      <rect y="150" width="900" height="300" fill="#002868" />
      <circle cx="450" cy="300" r="120" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * Universal Lottery Flag renderer.
 * Automatically resolves lottery code/name into cross-platform SVG vector flags.
 */
export default function LotteryFlag({ code, className = "w-7 h-5 inline-block rounded shadow-sm shrink-0 overflow-hidden align-middle" }) {
  const norm = String(code || '').toUpperCase();
  if (norm.includes('THAI') || norm === 'TH') {
    return <ThaiFlag className={className} />;
  }
  if (norm.includes('LAO') || norm === 'LA') {
    return <LaoFlag className={className} />;
  }
  return <span className="inline-block text-base leading-none">🎲</span>;
}
