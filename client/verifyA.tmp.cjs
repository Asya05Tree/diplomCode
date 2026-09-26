const { chromium } = require('playwright');
const SHOT_DIR = 'C:/Users/Nasya/AppData/Local/Temp/claude/C--Users-Nasya-Desktop-------/a945d996-111a-4d73-956d-89f650e1aafa/scratchpad';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const consoleErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (err) => consoleErrors.push(String(err)));

  await page.goto('http://localhost:5173');
  await page.click('.landing-choice >> nth=1'); // Вхід
  await page.waitForSelector('.login-page');
  await page.screenshot({ path: `${SHOT_DIR}/17-login-empty.png` });

  // Символьна фільтрація email: кириличні літери мають бути відкинуті
  await page.fill('input[type=email]', 'тестabc123@gmail.com');
  const emailValue = await page.inputValue('input[type=email]');
  console.log('EMAIL_AFTER_FILTER=' + emailValue);

  // Заповнюємо пароль -> має зʼявитись картинка "go"
  await page.fill('input[type=password]', 'somepass');
  await page.waitForTimeout(500);
  const goOpacity = await page.locator('.login-image--go').evaluate((el) => getComputedStyle(el).opacity);
  console.log('GO_OPACITY_AFTER_BOTH_FILLED=' + goOpacity);
  await page.screenshot({ path: `${SHOT_DIR}/18-login-both-filled.png` });

  // Очищуємо пароль -> має повернутись "stop"
  await page.fill('input[type=password]', '');
  await page.waitForTimeout(500);
  const goOpacityAfterClear = await page.locator('.login-image--go').evaluate((el) => getComputedStyle(el).opacity);
  console.log('GO_OPACITY_AFTER_CLEAR=' + goOpacityAfterClear);

  // Невалідний формат email -> помилка при сабміті
  await page.fill('input[type=email]', 'not-an-email');
  await page.fill('input[type=password]', 'somepass');
  await page.click('button:has-text("Увійти")');
  await page.waitForTimeout(300);
  console.log('LOGIN_FORMAT_ERROR=' + await page.locator('.auth-error').textContent().catch(() => 'none'));

  await browser.close();
  console.log('CONSOLE_ERRORS=' + JSON.stringify(consoleErrors));
})();
