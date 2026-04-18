export default function Button({ children, variant = 'primary', href, onClick, className = '', ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all duration-200 cursor-pointer'

  const variants = {
    primary: 'bg-gradient-to-r from-violet-600 to-cyan-600 text-white hover:opacity-90 hover:scale-[1.02] shadow-lg shadow-violet-500/20',
    secondary: 'border border-gray-700 text-gray-200 hover:border-violet-500 hover:text-violet-400 bg-transparent',
    whatsapp: 'bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-500/20 hover:scale-[1.02]',
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
