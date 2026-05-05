export default function Button({ children, variant = 'primary', href, onClick, className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer'

  const variants = {
    primary: 'leo-btn-primary hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(201,146,42,0.5)]',
    secondary: 'leo-btn-secondary',
    whatsapp: 'leo-btn-whatsapp hover:brightness-110 shadow-lg shadow-green-500/20',
  }

  const cls = `${base} ${variants[variant]} ${className}`

  if (href) {
    return (
      <a href={href} className={cls} target="_blank" rel="noopener noreferrer" {...props}>
        {children}
      </a>
    )
  }

  return (
    <button onClick={onClick} className={cls} {...props}>
      {children}
    </button>
  )
}
