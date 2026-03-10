import { MathJaxContext } from 'better-react-mathjax'

const MATHJAX_CONFIG = {
  tex: {
    inlineMath: [['$', '$'], ['\\(', '\\)']],
    displayMath: [['$$', '$$'], ['\\[', '\\]']],
  },
  options: {
    skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
  },
}

/**
 * APMathProvider - Wraps children in MathJaxContext for LaTeX rendering.
 * Uses MathJax 3 CDN loaded on demand.
 */
export default function APMathProvider({ children }) {
  return (
    <MathJaxContext config={MATHJAX_CONFIG}>
      {children}
    </MathJaxContext>
  )
}
