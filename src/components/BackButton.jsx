import { Link } from 'react-router-dom'

const BackButton = ({ text = '← Back to Dashboard', className = '' }) => {
  return (
    <Link
      to="/"
      className={`mb-6 flex items-center gap-2 font-medium text-slate-500 transition hover:text-slate-800 ${className}`}
    >
      {text}
    </Link>
  )
}

export default BackButton

