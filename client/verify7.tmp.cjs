const { chromium } = require('playwright');
const SHOT_DIR = 'C:/Users/Nasya/AppData/Local/Temp/claude/C--Users-Nasya-Desktop-------/a945d996-111a-4d73-956d-89f650e1aafa/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto('http://localhost:5173');
  console.log('TITLE=' + await page.title());

  await page.click('.landing-choice >> nth=0');
  await page.waitForSelector('.auth-form');

  // 1. Невалідний нікнейм
  await page.fill('.auth-form input:not([type=email]):not([type=password])', 'Test123')
  await page.fill('input[type=email]', 'nastenka05m@gmail.com')
  await page.click('.auth-inline button')
  await page.waitForTimeout(300)
  console.log('ERROR_AFTER_BAD_NICKNAME=' + await page.locator('.auth-error').textContent().catch(() => 'none'))

  // 2. Невалідний email (не gmail)
  await page.fill('.auth-form input:not([type=email]):not([type=password])', 'ТестНік')
  await page.fill('input[type=email]', 'someone@yahoo.com')
  await page.click('.auth-inline button')
  await page.waitForTimeout(300)
  console.log('ERROR_AFTER_BAD_EMAIL=' + await page.locator('.auth-error').textContent().catch(() => 'none'))

  // 3. Все коректно -> надсилаємо код
  await page.fill('input[type=email]', 'nastenka05m@gmail.com')
  await page.click('.auth-inline button')
  await page.waitForTimeout(1500)
  console.log('SEND_RESULT=' + await page.locator('.auth-inline button').textContent())

  await browser.close();
  console.log('CONSOLE_ERRORS=' + JSON.stringify(consoleErrors));
})();
