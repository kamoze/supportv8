import React from "react";

interface SupportV8LogoProps {
  className?: string;
  size?: number;
  showText?: boolean;
}

export function SupportV8Logo({
  className = "",
  size = 34,
  showText = true,
}: SupportV8LogoProps) {
  return (
    <div className="flex items-center gap-2.5 select-none shrink-0">
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`shrink-0 ${className}`}
      >
        <defs>
          {/* Radiant Teal Gradient */}
          <linearGradient
            id="sv8-teal-gradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#00F2FE" />
            <stop offset="45%" stopColor="#2ED8B6" />
            <stop offset="85%" stopColor="#20C997" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>

          {/* Glowing Inner Highlight */}
          <linearGradient
            id="sv8-highlight-grad"
            x1="20%"
            y1="0%"
            x2="80%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#2ED8B6" stopOpacity="0.2" />
          </linearGradient>

          {/* Dot 1: Red */}
          <linearGradient
            id="sv8-dot-red"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#FF6B6B" />
            <stop offset="100%" stopColor="#E5484D" />
          </linearGradient>

          {/* Dot 2: Orange */}
          <linearGradient
            id="sv8-dot-orange"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#FFA940" />
            <stop offset="100%" stopColor="#F5A623" />
          </linearGradient>

          {/* Dot 3: Green */}
          <linearGradient
            id="sv8-dot-green"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#4ADE80" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>

          {/* Soft Teal Atmosphere Glow */}
          <filter id="sv8-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow
              dx="0"
              dy="2"
              stdDeviation="4"
              floodColor="#2ED8B6"
              floodOpacity="0.4"
            />
          </filter>
        </defs>

        {/* Outer Background Subtle Circle for Contrast */}
        <circle cx="50" cy="50" r="46" fill="#121A24" stroke="rgba(46, 216, 182, 0.18)" strokeWidth="1.5" />

        {/* Redesigned Sleek S-Chat Dynamic Ribbon in Vibrant Teal */}
        <path
          d="M 52 18
             C 33 18, 20 30, 20 45
             C 20 54, 25 62, 33 67
             L 22 84
             C 20.5 86.5, 23 89, 25.5 87.5
             L 42 78
             C 45.2 79.2, 48.5 80, 52 80
             C 71 80, 84 68, 84 52
             C 84 38, 73 28, 60 25
             C 45 22, 36 28, 34 36
             C 33 40, 36 43, 40 43
             C 44 43, 47 40, 48 37
             C 50 32, 55 29, 61 31
             C 69 33, 74 40, 74 50
             C 74 61, 64 70, 52 70
             C 48.5 70, 45 69, 41.5 67.5
             L 34 72
             L 39 63
             C 33.5 58.5, 30 52, 30 45
             C 30 35, 39 27, 52 27
             C 63 27, 72 33, 74 41
             C 75 44, 78.5 46, 82 44.5
             C 85.5 43, 86.5 39.5, 84.5 36
             C 79 24, 67 18, 52 18 Z"
          fill="url(#sv8-teal-gradient)"
          filter="url(#sv8-glow)"
        />

        {/* 3 Conversational Status Dots: Red, Orange, Green */}
        <circle cx="42" cy="49" r="3.75" fill="url(#sv8-dot-red)" />
        <circle cx="52" cy="49" r="3.75" fill="url(#sv8-dot-orange)" />
        <circle cx="62" cy="49" r="3.75" fill="url(#sv8-dot-green)" />
      </svg>

      {showText && (
        <div className="flex flex-col">
          <div className="text-[17px] font-extrabold tracking-[-0.035em] flex items-center leading-none font-sans select-none">
            <span className="text-white font-extrabold">support</span>
            <span className="text-[#2ED8B6] font-mono font-extrabold tracking-[-0.02em] ml-0.5">V8</span>
          </div>
          <span className="text-[8px] font-bold tracking-[0.24em] text-[#6B7C8D] uppercase font-mono mt-1 leading-none">
            AI-POWERED SUPPORT
          </span>
        </div>
      )}
    </div>
  );
}
