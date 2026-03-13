/**
 * Windows PowerShell quick commands for running tests:
 *
 * Run Playwright tests against the production Netlify site:
 *   cd ...\resentencing-project-website
 *   $env:BASE_URL = "https://resentencing.netlify.app"
 *   npx playwright test
 *
 * Run Playwright tests against a local dev server (start `npm run dev` first):
 *   cd ...\resentencing-project-website
 *   $env:BASE_URL = "http://localhost:5173"
 *   npx playwright test
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('ResentencingAI frontend', () => {
  test('home page loads and basic accessibility is ok', async ({ page }) => {
    await page.goto('/');

    // Title and main heading
    await expect(page).toHaveTitle(/ResentencingAI/i);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('ResentencingAI');

    // Run axe accessibility scan on the main page
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test('chat widget opens and sends a message', async ({ page }) => {
    await page.goto('/');

    // Open chat
    const chatToggle = page.getByRole('button', { name: /open chat/i });
    await chatToggle.click();

    const chatDialog = page.getByRole('dialog', { name: /ai assistant/i }).first();
    await expect(chatDialog).toBeVisible();

    const textArea = chatDialog.locator('textarea');
    await textArea.fill('Test query from CI');
    const sendButton = chatDialog.getByRole('button', { name: /send message/i });
    await sendButton.click();

    // Wait for some message content to appear in the chat messages area
    const messagesContainer = chatDialog.locator('.chat-messages');
    await expect(messagesContainer).not.toBeEmpty();
  });

  test('mobile chat launcher toggles modal and backdrop taps above and below close it', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    const chatToggle = page.getByRole('button', { name: /open chat/i });
    const chatModal = page.locator('#chat-modal');
    const chatModalCard = page.locator('#chat-modal > div > div');
    const chatModalInput = page.locator('#chat-modal-input');

    await chatToggle.click();
    await expect(chatModal).toBeVisible();

    const fontSize = await chatModalInput.evaluate((el) =>
      Number.parseFloat(window.getComputedStyle(el).fontSize)
    );
    expect(fontSize).toBeGreaterThanOrEqual(16);

    await chatToggle.click();
    await expect(chatModal).toBeHidden();

    const clickOutsideModalCard = async (position: 'above' | 'below') => {
      await chatToggle.click();
      await expect(chatModal).toBeVisible();

      const modalCardBox = await chatModalCard.boundingBox();
      expect(modalCardBox).not.toBeNull();

      const viewport = page.viewportSize();
      expect(viewport).not.toBeNull();

      if (!modalCardBox || !viewport) {
        throw new Error('Expected modal card bounds and viewport size for outside-click test');
      }

      const x = modalCardBox.x + modalCardBox.width / 2;
      const y =
        position === 'above'
          ? Math.max(4, modalCardBox.y - 8)
          : Math.min(viewport.height - 4, modalCardBox.y + modalCardBox.height + 8);

      await page.mouse.click(x, y);
      await expect(chatModal).toBeHidden();
    };

    await clickOutsideModalCard('above');
    await clickOutsideModalCard('below');
  });

  test('desktop expanded modal ignores backdrop clicks and closes from the launcher', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');

    const chatToggle = page.getByRole('button', { name: /open chat/i });
    const chatPanel = page.locator('#chat-panel');
    const chatExpand = page.locator('#chat-expand');
    const chatModal = page.locator('#chat-modal');
    const chatModalCard = page.locator('#chat-modal > div > div');

    await chatToggle.click();
    await expect(chatPanel).toBeVisible();

    await chatExpand.click();
    await expect(chatPanel).toBeHidden();
    await expect(chatModal).toBeVisible();

    const modalCardBox = await chatModalCard.boundingBox();
    expect(modalCardBox).not.toBeNull();

    if (!modalCardBox) {
      throw new Error('Expected modal card bounds for desktop backdrop test');
    }

    const x = Math.max(4, modalCardBox.x - 8);
    const y = modalCardBox.y + modalCardBox.height / 2;

    await page.mouse.click(x, y);
    await expect(chatModal).toBeVisible();

    await chatToggle.click();
    await expect(chatModal).toBeHidden();
    await expect(chatPanel).toBeHidden();
  });

  test('hero parallax is disabled on mobile and stays active on desktop', async ({ page }) => {
    const hero = page.locator('.hero-section');

    await page.setViewportSize({ width: 390, height: 600 });
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 200));
    await expect
      .poll(async () => hero.evaluate((el) => el.style.backgroundPositionY || ''))
      .toBe('');

    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 200));
    await expect
      .poll(async () => hero.evaluate((el) => el.style.backgroundPositionY))
      .toBe('100px');
  });

	test('ai-proxy contract test returns expected JSON shape', async ({ request, baseURL }) => {
	  if (!baseURL) {
		throw new Error('BASE_URL is not set');
	  }

	  const endpoint = new URL('/.netlify/functions/ai-proxy', baseURL).toString();

	  const response = await request.post(endpoint, {
		data: { query: 'Ping from CI. Please respond briefly.' },
		headers: {
		  // Pretend the call is coming from the frontend site
		  origin: baseURL,
		  'content-type': 'application/json'
		}
	  });

	  expect(response.status()).toBe(200);
	  const json = await response.json();

	  // Contract check: top level "response" field of type string
	  expect(typeof json.response).toBe('string');
	  expect(json.response.length).toBeGreaterThan(0);
	});
});
