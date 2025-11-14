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
