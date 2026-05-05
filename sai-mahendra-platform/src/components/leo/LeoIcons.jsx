export function CrownIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 18L5.5 7L12 12L18.5 7L21 18H3Z" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 18V20H17V18" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

export function PawIcon({ className = 'w-5 h-5' }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <circle cx="6.5" cy="8.5" r="2.1" />
      <circle cx="10.5" cy="6.5" r="2.1" />
      <circle cx="14.5" cy="6.5" r="2.1" />
      <circle cx="18" cy="9" r="2" />
      <path d="M12.2 12.2C9 12.2 6.3 14.4 6.3 17C6.3 19.6 8.8 21 12.2 21C15.7 21 18.2 19.6 18.2 17C18.2 14.4 15.5 12.2 12.2 12.2Z" />
    </svg>
  )
}
