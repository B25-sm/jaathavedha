const letters = ['L', 'E', 'O', 'V', 'E', 'X']

export default function LeoLoader() {
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-[#0D0B07] leo-loader-screen">
      <svg
        viewBox="0 0 120 120"
        className="w-20 h-20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M60 8L70 23H50L60 8Z" fill="#F5C842" />
        <path d="M20 38L38 24L52 42L34 54L20 38Z" className="leo-loader-path" stroke="#C9922A" strokeWidth="3" />
        <path d="M100 38L82 24L68 42L86 54L100 38Z" className="leo-loader-path" stroke="#C9922A" strokeWidth="3" />
        <path
          d="M24 66C24 45 40 30 60 30C80 30 96 45 96 66C96 86 80 102 60 102C40 102 24 86 24 66Z"
          className="leo-loader-path"
          stroke="#C9922A"
          strokeWidth="4"
        />
      </svg>
      <div className="flex gap-1 text-lg tracking-[0.16em]" style={{ fontFamily: 'var(--font-display)', color: 'var(--leo-sunlit)' }}>
        {letters.map((letter, i) => (
          <span key={letter + i} style={{ animation: `mane-expand 0.25s ease-out ${i * 0.08}s both` }}>
            {letter}
          </span>
        ))}
      </div>
    </div>
  )
}
