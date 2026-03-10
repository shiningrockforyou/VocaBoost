/**
 * B5: CSS Token Verification Test
 * Tests if text-warning-text and text-error-text resolve correctly
 */
const { chromium } = require('playwright');

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    // Login first to get to a page with the apBoost CSS loaded
    await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(1500);
    await page.fill('input[type="email"]', 'teacher@apboost.test');
    await page.fill('input[type="password"]', 'Teacher123!');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(3000);

    // Navigate to AP page to ensure apBoost CSS is loaded
    await page.goto('http://localhost:5173/ap', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(2000);

    // Now do a comprehensive CSS token test
    const tokenTest = await page.evaluate(() => {
      const results = {};

      // Test each class by creating temporary elements
      const classes = [
        'text-text-primary',
        'text-text-secondary',
        'text-text-muted',
        'text-error-text',
        'text-error-text-strong',
        'text-warning-text',
        'text-warning-text-strong',
        'text-text-error',
        'text-text-error-strong',
        'text-text-warning',
        'text-text-warning-strong',
        'text-success-text',
        'text-success-text-strong',
      ];

      const body = document.body;
      for (const cls of classes) {
        const tmp = document.createElement('span');
        tmp.className = cls;
        body.appendChild(tmp);
        const color = getComputedStyle(tmp).color;
        results[cls] = color;
        body.removeChild(tmp);
      }

      // Also check CSS custom properties
      const rootStyles = getComputedStyle(document.documentElement);
      const cssVars = {};
      const varNames = [
        '--color-error-text',
        '--color-warning-text',
        '--color-text-error',
        '--color-text-warning',
        '--color-error-text-strong',
        '--color-warning-text-strong',
        '--color-text-error-strong',
        '--color-text-warning-strong',
      ];
      for (const v of varNames) {
        cssVars[v] = rootStyles.getPropertyValue(v).trim();
      }

      // Check if these are actually different colors
      const primaryColor = results['text-text-primary'];
      const analysis = {};
      for (const [cls, color] of Object.entries(results)) {
        analysis[cls] = {
          color,
          sameAsPrimary: color === primaryColor,
        };
      }

      return { analysis, cssVars, primaryColor };
    });

    console.log('\n=== CSS TOKEN ANALYSIS ===');
    console.log('Primary color:', tokenTest.primaryColor);
    console.log('\nClass → Color (sameAsPrimary?):');
    for (const [cls, info] of Object.entries(tokenTest.analysis)) {
      console.log(`  ${cls}: ${info.color} ${info.sameAsPrimary ? '(SAME AS PRIMARY!)' : '(DIFFERENT - OK)'}`);
    }

    console.log('\nCSS Variables:');
    for (const [v, val] of Object.entries(tokenTest.cssVars)) {
      console.log(`  ${v}: "${val}"`);
    }

    // Additional: Check what classes are actually applied to elements in the DOM
    const timerResult = await page.evaluate(() => {
      // Navigate to test to find timer
      return null; // Will check after navigation
    });

    // Check the actual generated CSS
    const cssCheck = await page.evaluate(() => {
      // Get all stylesheets and look for error-text and warning-text rules
      const rules = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText &&
                (rule.selectorText.includes('error-text') ||
                 rule.selectorText.includes('warning-text'))) {
              rules.push({
                selector: rule.selectorText,
                css: rule.style.cssText.substring(0, 100),
              });
            }
          }
        } catch (e) {
          // CORS error for external sheets
        }
      }
      return rules;
    });

    console.log('\nCSS Rules for error-text/warning-text:');
    if (cssCheck.length === 0) {
      console.log('  NO RULES FOUND - these classes may not be generating valid CSS');
    } else {
      cssCheck.slice(0, 20).forEach(r => console.log(`  ${r.selector}: ${r.css}`));
    }

    // Look for any Tailwind-generated classes
    const allColorRules = await page.evaluate(() => {
      const rules = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (rule.selectorText && rule.style && rule.style.color &&
                rule.style.color !== '' && rule.selectorText.includes('text-')) {
              rules.push({
                selector: rule.selectorText.substring(0, 80),
                color: rule.style.color.substring(0, 80),
              });
            }
          }
        } catch (e) {}
      }
      return rules.slice(0, 30);
    });
    console.log('\nSample of text-* color rules in stylesheets:');
    allColorRules.forEach(r => console.log(`  ${r.selector}: ${r.color}`));

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await browser.close();
  }
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
