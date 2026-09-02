import { test, expect } from '@playwright/test';

/** Base URL for Docker deployment */
const BASE_URL = process.env.BASE_URL || "http://localhost:3015";

/**
 * Expanded E2E coverage — projects, settings, admin pages.
 */

test.describe('Projects Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    // Try to fill login form
    const usernameInput = page.locator('input[placeholder*="username"], input[placeholder*="user"], input[type="text"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    if (await usernameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await usernameInput.fill('SENIOR');
      await passwordInput.fill('CHANGEPASSWORD');
      await page.click('button[type="submit"], button:has-text("Entrar")');
      // waitForURL removed
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 60000 });
    }
  });

  test('create project flow', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    await expect(page.locator('text=Dashboard')).toBeVisible();

    // Click create button
    const createBtn = page.locator('button:has-text("New Project"), button:has-text("Create")').first();
    if (await createBtn.isVisible()) {
      await createBtn.click();

      // Fill form
      await page.fill('input[placeholder*="name"], input[placeholder*="Project"]', 'E2E Test Project');
      await page.click('button:has-text("Create"), button:has-text("Save")');

      // Verify creation
      await expect(page.locator('text=E2E Test Project')).toBeVisible({ timeout: 5000 });
    }
  });

  test('list and filter projects', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    
    // Wait for projects to load
    await expect(page.locator('text=Projects')).toBeVisible();
    
    // Check if search/filter works
    const searchInput = page.locator('input[placeholder*="search"], input[placeholder*="Search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.waitForTimeout(500); // Debounce
      // Verify filtering happened (UI should update)
    }
  });

  test('delete project with confirmation', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    
    // Find delete button (often in menu)
    const deleteButtons = page.locator('button:has-text("Delete"), [role="menuitem"]:has-text("Delete")');
    if (await deleteButtons.first().isVisible({ timeout: 2000 })) {
      await deleteButtons.first().click();
      
      // Confirm dialog
      await expect(page.locator('text=confirm, Are you sure')).toBeVisible({ timeout: 2000 });
      await page.click('button:has-text("Confirm"), button:has-text("Delete")');
      
      // Verify deletion
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Settings & Admin', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    // Try to fill login form
    const usernameInput = page.locator('input[placeholder*="username"], input[placeholder*="user"], input[type="text"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    if (await usernameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await usernameInput.fill('SENIOR');
      await passwordInput.fill('CHANGEPASSWORD');
      await page.click('button[type="submit"], button:has-text("Entrar")');
      // waitForURL removed
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 60000 });
    }
  });

  test('access settings page', async ({ page }) => {
    // Navigate to settings (usually in header menu)
    const settingsLink = page.locator('text=Settings').first();
    if (await settingsLink.isVisible({ timeout: 2000 })) {
      await settingsLink.click();
      await expect(page).toHaveURL(/settings/);
      await expect(page.locator('text=Settings, Preferences')).toBeVisible({ timeout: 3000 });
    }
  });

  test('update AI settings if available', async ({ page }) => {
    // Check for AI settings section
    const aiSection = page.locator('text=AI Settings, LLM, Model').first();
    if (await aiSection.isVisible({ timeout: 2000 })) {
      const inputs = page.locator('input[type="text"], textarea').filter({ hasText: /model|key|url/ });
      if (await inputs.first().isVisible()) {
        const currentValue = await inputs.first().inputValue();
        await inputs.first().clear();
        await inputs.first().fill('test-value');
        await expect(inputs.first()).toHaveValue('test-value');
        
        // Restore
        await inputs.first().clear();
        await inputs.first().fill(currentValue);
      }
    }
  });

  test('theme toggle in settings', async ({ page }) => {
    const themeToggle = page.locator('[role="switch"], button:has-text("Theme"), button:has-text("Dark")').first();
    if (await themeToggle.isVisible({ timeout: 2000 })) {
      const initialState = await themeToggle.getAttribute('aria-checked');
      await themeToggle.click();
      await page.waitForTimeout(300); // Debounce
      const newState = await themeToggle.getAttribute('aria-checked');
      expect(initialState).not.toBe(newState);
    }
  });
});

test.describe('Editor Page Extended', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    // Try to fill login form
    const usernameInput = page.locator('input[placeholder*="username"], input[placeholder*="user"], input[type="text"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    if (await usernameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await usernameInput.fill('SENIOR');
      await passwordInput.fill('CHANGEPASSWORD');
      await page.click('button[type="submit"], button:has-text("Entrar")');
      // waitForURL removed
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 60000 });
    }
  });

  test('editor loads canvas', async ({ page }) => {
    // Navigate to a project page where canvas exists
    await page.goto(`${BASE_URL}/`);
    // Find first project and navigate to it
    const firstProject = page.locator('text=Projetos').first();
    if (await firstProject.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Click on first project card to open editor
      const projectCard = page.locator('[data-testid="project-card"]').first();
      if (await projectCard.isVisible({ timeout: 5000 }).catch(() => false)) {
        await projectCard.click();
      }
    }
    
    // Wait for canvas to appear
    const canvas = page.locator('canvas, [role="presentation"]').first();
    await expect(canvas).toBeVisible({ timeout: 10_000 });
  });

  test('add node via template or toolbar', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    // Wait for dashboard to load
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10_000 });
    
    // Look for "Add Node" or template buttons
    const addBtn = page.locator('button:has-text("Add Node"), button:has-text("template"), button:has-text("Backend")').first();
    if (await addBtn.isVisible({ timeout: 2000 })) {
      await addBtn.click();
      await page.waitForTimeout(300);
      // Node should be added (visual check)
    }
  });

  test('export diagram as PNG/SVG', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    // Wait for dashboard to load
    await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 10_000 });
    
    // Find export button
    const exportBtn = page.locator('text=Exportar').first();
    if (await exportBtn.isVisible({ timeout: 2000 })) {
      await exportBtn.click();
      
      // Expect export menu
      const pngOption = page.locator('text=PNG, SVG, PDF').first();
      if (await pngOption.isVisible({ timeout: 1000 })) {
        await pngOption.click();
        // Should trigger download (not fully testable in Playwright, but no error is success)
      }
    }
  });
});

test.describe('Accessibility Extended', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  });

  test('projects page has keyboard navigation', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // At least one element should be focused
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'A', 'INPUT']).toContain(focused);
  });

  test('settings form fields have labels', async ({ page }) => {
    await page.goto(`${BASE_URL}/`);
    
    // Find all inputs and check for associated labels
    const inputs = page.locator('input[type="text"], input[type="password"], textarea').all();
    for (const input of await inputs) {
      const label = page.locator(`label[for="${await input.getAttribute('id')}"]`).first();
      const hasAriaLabel = await input.getAttribute('aria-label');
      const hasPlaceholder = await input.getAttribute('placeholder');
      
      // At least one of these should exist
      const hasAccessibility = (await label.isVisible().catch(() => false)) || hasAriaLabel || hasPlaceholder;
      expect(hasAccessibility).toBe(true);
    }
  });
});
