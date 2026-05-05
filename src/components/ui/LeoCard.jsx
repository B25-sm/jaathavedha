export function LeoTrackCard({ children, className = '' }) {
  return <div className={`leo-card rounded-2xl p-6 ${className}`}>{children}</div>
}

export function LeoPriceCard({ children, featured = false, className = '' }) {
  return <div className={`leo-card rounded-2xl p-6 ${featured ? 'leo-card-featured' : ''} ${className}`}>{children}</div>
}
