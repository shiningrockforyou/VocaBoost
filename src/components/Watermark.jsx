/**
 * Watermark component - displays a subtle logo watermark in the center of the screen.
 * Used across study sessions, tests, and other full-screen views.
 */
const Watermark = () => (
  <div className="pointer-events-none fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vmin] h-[90vmin] opacity-5 z-0">
    <img
      src="/logo_square_vector.svg"
      alt="VocaBoost watermark"
      className="h-full w-full object-contain"
    />
  </div>
)

export default Watermark
