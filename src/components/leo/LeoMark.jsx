export default function LeoMark({ className = "w-8 h-8", eyeClassName = "", withText = false }) {
  return (
    <div className={`inline-flex items-center gap-2 ${withText ? "" : "justify-center"}`}>
      <svg
        viewBox="0 0 120 120"
        className={className}
        role="img"
        aria-label="Leovex lion mark"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="leoMane" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#F5C842" />
            <stop offset="60%" stopColor="#C9922A" />
            <stop offset="100%" stopColor="#7A4F10" />
          </linearGradient>
          <radialGradient id="leoFace" cx="0.5" cy="0.4" r="0.7">
            <stop offset="0%" stopColor="#2A2210" />
            <stop offset="100%" stopColor="#0D0B07" />
          </radialGradient>
        </defs>
        <path d="M60 8L70 23H50L60 8Z" fill="url(#leoMane)" />
        <g opacity="0.9">
          <path d="M60 14L66 4L72 14" stroke="#F5C842" strokeWidth="2" strokeLinecap="round" />
          <path d="M40 26L31 20L34 32" stroke="#C9922A" strokeWidth="2" strokeLinecap="round" />
          <path d="M80 26L89 20L86 32" stroke="#C9922A" strokeWidth="2" strokeLinecap="round" />
        </g>
        <path
          d="M20 38L38 24L52 42L34 54L20 38Z M100 38L82 24L68 42L86 54L100 38Z"
          fill="url(#leoMane)"
          opacity="0.95"
        />
        <path
          d="M24 66C24 45 40 30 60 30C80 30 96 45 96 66C96 86 80 102 60 102C40 102 24 86 24 66Z"
          fill="url(#leoFace)"
          stroke="#C9922A"
          strokeWidth="4"
        />
        <path d="M60 30V102" stroke="rgba(245,200,66,0.2)" strokeWidth="1.2" />
        <path d="M24 66H96" stroke="rgba(245,200,66,0.12)" strokeWidth="1.2" />
        <path d="M47 74L60 87L73 74" stroke="#E8A83E" strokeWidth="4" strokeLinecap="round" />
        <circle className={`leo-eye ${eyeClassName}`} cx="49" cy="58" r="4" fill="#F5C842" />
        <circle className={`leo-eye ${eyeClassName}`} cx="71" cy="58" r="4" fill="#F5C842" />
      </svg>
      {withText && (
        <span className="text-[1.05rem] font-semibold tracking-[0.14em] gradient-text" style={{ fontFamily: "var(--font-display)" }}>
          LEOVEX
        </span>
      )}
    </div>
  )
}
