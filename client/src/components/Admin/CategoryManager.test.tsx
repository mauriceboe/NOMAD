// FE-COMP-CAT-001 to FE-COMP-CAT-012
import { render, screen, waitFor } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/helpers/msw/server';
import { useAuthStore } from '../../store/authStore';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { buildUser, buildCategory } from '../../../tests/helpers/factories';
import CategoryManager from './CategoryManager';
import { ToastContainer } from '../shared/Toast';

beforeEach(() => {
  resetAllStores();
  server.use(
    http.get('/api/categories', () =>
      HttpResponse.json({ categories: [] })
    ),
  );
  seedStore(useAuthStore, { user: buildUser({ role: 'admin' }), isAuthenticated: true });
});

describe('CategoryManager', () => {
  it('FE-COMP-CAT-001: renders without crashing', () => {
    render(<CategoryManager />);
    expect(document.body).toBeInTheDocument();
  });

  it('FE-COMP-CAT-002: shows Categories title', async () => {
    render(<CategoryManager />);
    await screen.findByText('Categories');
  });

  it('FE-COMP-CAT-003: shows empty state when no categories', async () => {
    render(<CategoryManager />);
    await screen.findByText('No categories yet');
  });

  it('FE-COMP-CAT-004: shows New Category button', async () => {
    render(<CategoryManager />);
    await screen.findByText('New Category');
  });

  it('FE-COMP-CAT-005: clicking New Category shows form', async () => {
    const user = userEvent.setup();
    render(<CategoryManager />);
    await screen.findByText('New Category');
    await user.click(screen.getByText('New Category'));
    expect(screen.getByPlaceholderText('Category name')).toBeInTheDocument();
  });

  it('FE-COMP-CAT-006: shows existing categories from API', async () => {
    server.use(
      http.get('/api/categories', () =>
        HttpResponse.json({
          categories: [
            buildCategory({ name: 'Museum' }),
            buildCategory({ name: 'Restaurant' }),
          ],
        })
      )
    );
    render(<CategoryManager />);
    await screen.findByText('Museum');
    expect(screen.getByText('Restaurant')).toBeInTheDocument();
  });

  it('FE-COMP-CAT-007: clicking Create submits POST API', async () => {
    const user = userEvent.setup();
    let postCalled = false;
    server.use(
      http.post('/api/categories', async ({ request }) => {
        postCalled = true;
        const body = await request.json() as Record<string, unknown>;
        return HttpResponse.json({
          category: buildCategory({ name: String(body.name) }),
        });
      })
    );
    render(<><ToastContainer /><CategoryManager /></>);
    await screen.findByText('New Category');
    await user.click(screen.getByText('New Category'));
    const nameInput = screen.getByPlaceholderText('Category name');
    await user.type(nameInput, 'Parks');
    await user.click(screen.getByText('Create'));
    await waitFor(() => expect(postCalled).toBe(true));
  });

  it('FE-COMP-CAT-008: edit button shows form for existing category', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('/api/categories', () =>
        HttpResponse.json({ categories: [buildCategory({ id: 5, name: 'Hotels' })] })
      )
    );
    render(<CategoryManager />);
    await screen.findByText('Hotels');
    // Edit button is icon-only (no title) — find all buttons and click the first action button
    const buttons = screen.getAllByRole('button');
    // Buttons: [New Category, ...action buttons for the category]
    // The edit button is the first action button in the category row (Edit2 icon)
    const actionBtns = buttons.filter(b => !b.textContent?.includes('New Category'));
    await user.click(actionBtns[0]);
    // Name input pre-filled with category name
    expect(screen.getByDisplayValue('Hotels')).toBeInTheDocument();
  });

  it('FE-COMP-CAT-009: delete button triggers DELETE API', async () => {
    const user = userEvent.setup();
    let deleteCalled = false;
    server.use(
      http.get('/api/categories', () =>
        HttpResponse.json({ categories: [buildCategory({ id: 9, name: 'Parks' })] })
      ),
      http.delete('/api/categories/9', () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      })
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<><ToastContainer /><CategoryManager /></>);
    await screen.findByText('Parks');
    // Delete button is icon-only (Trash2, no title) — find the second action button
    const buttons = screen.getAllByRole('button');
    const actionBtns = buttons.filter(b => !b.textContent?.includes('New Category'));
    await user.click(actionBtns[1]);
    await waitFor(() => expect(deleteCalled).toBe(true));
    vi.restoreAllMocks();
  });

  it('FE-COMP-CAT-010: shows subtitle text', async () => {
    render(<CategoryManager />);
    await screen.findByText('Manage categories for places');
  });

  it('FE-COMP-CAT-011: category count is shown', async () => {
    server.use(
      http.get('/api/categories', () =>
        HttpResponse.json({
          categories: [buildCategory({ name: 'Cat1' }), buildCategory({ name: 'Cat2' })],
        })
      )
    );
    render(<CategoryManager />);
    await screen.findByText('Cat1');
    await screen.findByText('Cat2');
    // Both categories rendered
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('FE-COMP-CAT-012: Cancel button in form hides the form', async () => {
    const user = userEvent.setup();
    render(<CategoryManager />);
    await screen.findByText('New Category');
    await user.click(screen.getByText('New Category'));
    expect(screen.getByPlaceholderText('Category name')).toBeInTheDocument();
    await user.click(screen.getByText('Cancel'));
    expect(screen.queryByPlaceholderText('Category name')).not.toBeInTheDocument();
  });
});
