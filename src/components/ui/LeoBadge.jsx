export function LeoBadgeGold({ children }) {
  return (
    <span className="bg-[rgba(201,146,42,0.15)] text-[var(--leo-amber)] border border-[rgba(201,146,42,0.3)] rounded-[20px] px-[14px] py-1 text-xs font-semibold uppercase tracking-[0.08em]">
      {children}
    </span>
  )
}

export function LeoBadgeCrown({ children }) {
  return (
    <span className="bg-[var(--gradient-gold)] text-[#0D0B07] rounded-[20px] px-[14px] py-1 text-xs font-bold uppercase tracking-[0.08em]">
      {children}
    </span>
  )
}
