import { MathJax } from 'better-react-mathjax'

/**
 * MathText - Renders text that may contain LaTeX math notation.
 * Uses MathJax 3 via better-react-mathjax.
 *
 * Supports:
 * - Inline math: $...$ or \(...\)
 * - Display math: $$...$$ or \[...\]
 *
 * If the text contains no math delimiters, it renders as plain text (no overhead).
 */
const MATH_PATTERN = /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]/

export default function MathText({ children, as: Tag = 'span', className = '' }) {
  if (!children || typeof children !== 'string') {
    return <Tag className={className}>{children}</Tag>
  }

  // Skip MathJax overhead if no math delimiters found
  if (!MATH_PATTERN.test(children)) {
    return <Tag className={className}>{children}</Tag>
  }

  return (
    <MathJax className={className} inline={Tag === 'span'}>
      {children}
    </MathJax>
  )
}
