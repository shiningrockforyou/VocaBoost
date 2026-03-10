/**
 * Shared logo loader for PDF generation
 * Loads the AP Boost logo as a base64 data URL for jsPDF addImage
 */

let cachedLogo = null

/**
 * Load the AP Boost logo for use in PDFs
 * @returns {Promise<string|null>} Base64 data URL or null if unavailable
 */
export async function loadLogoForPdf() {
  if (cachedLogo) return cachedLogo

  try {
    const response = await fetch('/apBoost/ap_logo_small.png')
    if (!response.ok) return null

    const blob = await response.blob()
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        cachedLogo = reader.result
        resolve(cachedLogo)
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}
