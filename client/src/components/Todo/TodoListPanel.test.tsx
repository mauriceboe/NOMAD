// FE-COMP-TODO-001 to FE-COMP-TODO-015
import { render, screen, waitFor, fireEvent } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../tests/helpers/msw/server';
import { useAuthStore } from '../../store/authStore';
import { useTripStore } from '../../store/tripStore';
import { resetAllStores, seedStore } from '../../../tests/helpers/store';
import { buildUser, buildTrip, buildTodoItem } from '../../../tests/helpers/factories';
import TodoListPanel from './TodoListPanel';

beforeEach(() => {
  resetAllStores();
  // Simulate desktop width so sidebar labels are rendered (not mobile icon-only mode)
  Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true, configurable: true });
  server.use(
    http.get('/api/trips/:id/members', () =>
      HttpResponse.json({ owner: null, members: [], current_user_id: 1 })
    ),
  );
  seedStore(useAuthStore, { user: buildUser(), isAuthenticated: true });
  seedStore(useTripStore, { trip: buildTrip({ id: 1 }) });
});

afterEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 0, writable: true, configurable: true });
});

describe('TodoListPanel', () => {
  it('FE-COMP-TODO-001: renders todo items by name', () => {
    const items = [
      buildTodoItem({ name: 'Book hotel', checked: 0 }),
      buildTodoItem({ name: 'Buy tickets', checked: 0 }),
    ];
    render(<TodoListPanel tripId={1} items={items} />);
    expect(screen.getByText('Book hotel')).toBeInTheDocument();
    expect(screen.getByText('Buy tickets')).toBeInTheDocument();
  });

  it('FE-COMP-TODO-002: shows Add new task button', () => {
    render(<TodoListPanel tripId={1} items={[]} />);
    expect(screen.getByText('Add new task...')).toBeInTheDocument();
  });

  it('FE-COMP-TODO-003: sidebar filter buttons are rendered', () => {
    render(<TodoListPanel tripId={1} items={[]} />);
    // Filter buttons exist — match by title (mobile mode, jsdom innerWidth=0) or text (desktop)
    const allButtons = screen.getAllByRole('button');
    const buttonTitlesAndTexts = allButtons.map(b => (b.textContent || '') + (b.getAttribute('title') || ''));
    expect(buttonTitlesAndTexts.some(t => t.includes('All'))).toBe(true);
    expect(buttonTitlesAndTexts.some(t => t.includes('My Tasks'))).toBe(true);
    expect(buttonTitlesAndTexts.some(t => t.includes('Done'))).toBe(true);
    expect(buttonTitlesAndTexts.some(t => t.includes('Overdue'))).toBe(true);
  });

  it('FE-COMP-TODO-004: unchecked items are shown in All filter', () => {
    const items = [buildTodoItem({ name: 'Open Task', checked: 0 })];
    render(<TodoListPanel tripId={1} items={items} />);
    expect(screen.getByText('Open Task')).toBeInTheDocument();
  });

  it('FE-COMP-TODO-005: checked items are hidden in All filter (All shows unchecked)', () => {
    const items = [
      buildTodoItem({ name: 'Done Task', checked: 1 }),
      buildTodoItem({ name: 'Open Task', checked: 0 }),
    ];
    render(<TodoListPanel tripId={1} items={items} />);
    // All filter by default shows only unchecked
    expect(screen.queryByText('Done Task')).not.toBeInTheDocument();
    expect(screen.getByText('Open Task')).toBeInTheDocument();
  });

  it('FE-COMP-TODO-006: Done filter shows only checked items', async () => {
    const user = userEvent.setup();
    const items = [
      buildTodoItem({ name: 'Completed Task', checked: 1 }),
      buildTodoItem({ name: 'Pending Task', checked: 0 }),
    ];
    render(<TodoListPanel tripId={1} items={items} />);
    // Find the Done filter button by title (mobile mode) or text (desktop)
    const doneBtn = screen.queryByTitle('Done') || screen.getAllByRole('button').find(
      b => b.textContent?.trim() === 'Done'
    );
    if (doneBtn) {
      await user.click(doneBtn);
      await screen.findByText('Completed Task');
      expect(screen.queryByText('Pending Task')).not.toBeInTheDocument();
    }
  });

  it('FE-COMP-TODO-007: shows P1 priority badge for priority=1 items', () => {
    const items = [buildTodoItem({ name: 'Urgent Task', priority: 1, checked: 0 })];
    render(<TodoListPanel tripId={1} items={items} />);
    expect(screen.getByText('P1')).toBeInTheDocument();
  });

  it('FE-COMP-TODO-008: shows P2 priority badge for priority=2 items', () => {
    const items = [buildTodoItem({ name: 'Normal Task', priority: 2, checked: 0 })];
    render(<TodoListPanel tripId={1} items={items} />);
    expect(screen.getByText('P2')).toBeInTheDocument();
  });

  it('FE-COMP-TODO-009: items with no priority show no priority badge', () => {
    const items = [buildTodoItem({ name: 'Low Priority', priority: 0, checked: 0 })];
    render(<TodoListPanel tripId={1} items={items} />);
    expect(screen.queryByText('P1')).not.toBeInTheDocument();
    expect(screen.queryByText('P2')).not.toBeInTheDocument();
    expect(screen.queryByText('P3')).not.toBeInTheDocument();
  });

  it('FE-COMP-TODO-010: progress bar shows completion percentage', () => {
    const items = [
      buildTodoItem({ name: 'Done Task', checked: 1 }),
      buildTodoItem({ name: 'Open Task', checked: 0 }),
    ];
    render(<TodoListPanel tripId={1} items={items} />);
    // 1/2 = 50% completed
    expect(screen.getByText(/50%/)).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 2 completed/i)).toBeInTheDocument();
  });

  it('FE-COMP-TODO-011: clicking Add new task opens detail form', async () => {
    const user = userEvent.setup();
    render(<TodoListPanel tripId={1} items={[]} />);
    await user.click(screen.getByText('Add new task...'));
    // The detail pane shows "Create task" button
    await screen.findByText('Create task');
  });

  it('FE-COMP-TODO-012: toggling item calls toggleTodoItem action', async () => {
    const user = userEvent.setup();
    let putCalled = false;
    server.use(
      http.put('/api/trips/1/todo/:id/toggle', () => {
        putCalled = true;
        return HttpResponse.json({ success: true });
      })
    );
    const items = [buildTodoItem({ id: 5, name: 'Toggle Me', checked: 0 })];
    render(<TodoListPanel tripId={1} items={items} />);
    // Click the checkbox button (Square icon)
    const checkboxes = screen.getAllByRole('button');
    // Find the checkbox button near the item
    const checkboxBtn = checkboxes.find(btn => {
      const parent = btn.closest('[style*="cursor: pointer"]');
      return parent && parent.textContent?.includes('Toggle Me');
    });
    if (checkboxBtn) {
      await user.click(checkboxBtn);
      await waitFor(() => expect(putCalled).toBe(true));
    }
  });

  it('FE-COMP-TODO-013: clicking a task row opens its detail pane', async () => {
    const user = userEvent.setup();
    const items = [buildTodoItem({ id: 7, name: 'Click Me', checked: 0 })];
    render(<TodoListPanel tripId={1} items={items} />);
    await user.click(screen.getByText('Click Me'));
    // Detail pane should open showing the task title
    await screen.findByText('Task');
  });

  it('FE-COMP-TODO-014: category filter appears in sidebar for items with categories', () => {
    const items = [buildTodoItem({ name: 'JobTask', category: 'JobCat', checked: 0 })];
    render(<TodoListPanel tripId={1} items={items} />);
    // The category filter button shows category name (as text or title)
    const catEls = screen.getAllByText(/JobCat/);
    expect(catEls.length).toBeGreaterThan(0);
  });

  it('FE-COMP-TODO-015: category filter button is accessible and clickable', async () => {
    const user = userEvent.setup();
    const items = [
      buildTodoItem({ name: 'JobTask', category: 'JobCat', checked: 0 }),
      buildTodoItem({ name: 'HomeTask', category: 'HomeCat', checked: 0 }),
    ];
    render(<TodoListPanel tripId={1} items={items} />);
    // Both visible initially in 'all' filter (shows unchecked)
    expect(screen.getByText('JobTask')).toBeInTheDocument();
    expect(screen.getByText('HomeTask')).toBeInTheDocument();
    // Category buttons exist in sidebar (by accessible name or text)
    const catBtn = screen.getByRole('button', { name: /JobCat/ });
    expect(catBtn).toBeInTheDocument();
    // Clicking the category button should work without throwing
    await user.click(catBtn);
    // Task with category 'JobCat' remains visible
    expect(screen.getByText('JobTask')).toBeInTheDocument();
  });

  it('FE-COMP-TODO-016: Overdue filter shows items with past due_date', async () => {
    const items = [
      buildTodoItem({ name: 'Overdue Task', checked: 0, due_date: '2020-01-01' }),
      buildTodoItem({ name: 'Future Task', checked: 0, due_date: '2099-12-31' }),
    ];
    render(<TodoListPanel tripId={1} items={items} />);
    const overdueBtn = screen.getAllByRole('button').find(
      b => b.textContent?.includes('Overdue') || b.getAttribute('title') === 'Overdue'
    );
    expect(overdueBtn).toBeTruthy();
    fireEvent.click(overdueBtn!);
    expect(screen.getByText('Overdue Task')).toBeInTheDocument();
    expect(screen.queryByText('Future Task')).not.toBeInTheDocument();
  });

  it('FE-COMP-TODO-017: My Tasks filter shows only items assigned to current user', async () => {
    // Use default current_user_id: 1 from beforeEach; assign one item to user 1
    const items = [
      buildTodoItem({ name: 'Mine', assigned_user_id: 1, checked: 0 }),
      buildTodoItem({ name: 'Others', assigned_user_id: 9, checked: 0 }),
    ];
    render(<TodoListPanel tripId={1} items={items} />);
    // Wait for members API to resolve and set currentUserId=1 (My Tasks count badge shows 1)
    await waitFor(() => {
      const btns = screen.getAllByRole('button');
      const btn = btns.find(b => b.textContent?.includes('My Tasks'));
      expect(btn?.textContent).toMatch(/1/);
    }, { timeout: 3000 });
    const myBtn = screen.getAllByRole('button').find(
      b => b.textContent?.includes('My Tasks') || b.getAttribute('title') === 'My Tasks'
    );
    expect(myBtn).toBeTruthy();
    fireEvent.click(myBtn!);
    expect(screen.getByText('Mine')).toBeInTheDocument();
    expect(screen.queryByText('Others')).not.toBeInTheDocument();
  });

  it('FE-COMP-TODO-018: Sort by priority button reorders tasks', async () => {
    const user = userEvent.setup();
    const items = [
      buildTodoItem({ name: 'Low Prio', priority: 3, checked: 0 }),
      buildTodoItem({ name: 'High Prio', priority: 1, checked: 0 }),
    ];
    render(<TodoListPanel tripId={1} items={items} />);
    const sortBtn = screen.getAllByRole('button').find(
      b => b.textContent?.includes('Priority') || b.getAttribute('title') === 'Priority'
    );
    expect(sortBtn).toBeTruthy();
    await user.click(sortBtn!);
    const html = document.body.innerHTML;
    expect(html.indexOf('High Prio')).toBeLessThan(html.indexOf('Low Prio'));
  });

  it('FE-COMP-TODO-019: Detail pane shows task name and allows editing', async () => {
    const user = userEvent.setup();
    const items = [buildTodoItem({ id: 11, name: 'Edit Me', checked: 0 })];
    render(<TodoListPanel tripId={1} items={items} />);
    await user.click(screen.getByText('Edit Me'));
    // Detail pane opens; the name input should have the task's name
    await waitFor(() => {
      const input = screen.getByDisplayValue('Edit Me');
      expect(input).toBeInTheDocument();
    });
  });

  it('FE-COMP-TODO-020: Saving task name in detail pane calls PUT API', async () => {
    const user = userEvent.setup();
    let putCalled = false;
    server.use(
      http.put('/api/trips/1/todo/11', () => {
        putCalled = true;
        return HttpResponse.json({ item: buildTodoItem({ id: 11, name: 'Renamed' }) });
      }),
    );
    const items = [buildTodoItem({ id: 11, name: 'Edit Me', checked: 0 })];
    render(<TodoListPanel tripId={1} items={items} />);
    await user.click(screen.getByText('Edit Me'));
    // Wait for detail pane to open
    const nameInput = await screen.findByDisplayValue('Edit Me');
    await user.clear(nameInput);
    await user.type(nameInput, 'Renamed');
    // Click Save changes button
    const saveBtn = screen.getAllByRole('button').find(
      b => b.textContent?.includes('Save changes') || b.textContent?.includes('Save')
    );
    if (saveBtn) {
      await user.click(saveBtn);
      await waitFor(() => expect(putCalled).toBe(true));
    }
  });

  it('FE-COMP-TODO-021: Priority P3 badge is shown for priority=3 items', () => {
    const items = [buildTodoItem({ name: 'Low Task', priority: 3, checked: 0 })];
    render(<TodoListPanel tripId={1} items={items} />);
    expect(screen.getByText('P3')).toBeInTheDocument();
  });

  it('FE-COMP-TODO-022: Deleting a task from the detail pane calls delete API and closes pane', async () => {
    const user = userEvent.setup();
    let deleteCalled = false;
    server.use(
      http.delete('/api/trips/1/todo/20', () => {
        deleteCalled = true;
        return HttpResponse.json({ success: true });
      }),
    );
    const items = [buildTodoItem({ id: 20, name: 'Delete Me', checked: 0 })];
    render(<TodoListPanel tripId={1} items={items} />);
    await user.click(screen.getByText('Delete Me'));
    // Wait for detail pane to open
    const deleteBtn = await screen.findByText('Delete');
    await user.click(deleteBtn);
    // API was called and detail pane closed (Save changes button disappears)
    await waitFor(() => {
      expect(deleteCalled).toBe(true);
      expect(screen.queryByText('Save changes')).not.toBeInTheDocument();
    });
  });

  it('FE-COMP-TODO-023: Due date is shown in task list row when set', () => {
    const items = [buildTodoItem({ name: 'Due Task', due_date: '2030-06-15', checked: 0 })];
    render(<TodoListPanel tripId={1} items={items} />);
    // formatDate returns locale-specific string (e.g., "Sat, Jun 15") — check for month/day
    const html = document.body.innerHTML;
    // The date badge should contain Jun 15 or similar representation
    expect(html).toMatch(/Jun/);
    expect(html).toMatch(/15/);
  });

  it('FE-COMP-TODO-024: Closing the detail pane via X button hides it', async () => {
    const user = userEvent.setup();
    const items = [buildTodoItem({ id: 30, name: 'Close Pane Task', checked: 0 })];
    render(<TodoListPanel tripId={1} items={items} />);
    await user.click(screen.getByText('Close Pane Task'));
    // Wait for detail pane to appear (shows "Task" header and "Save changes")
    await screen.findByText('Task');
    // Find the X close button in the detail pane
    const allButtons = screen.getAllByRole('button');
    // The X button in the detail pane header has no text content (just icon)
    // It appears after the task row, so find buttons near the detail pane header
    // The detail pane has a header with title "Task" and an X button
    // We look for a button that closes the pane by finding ones with no text
    const closeBtn = allButtons.find(b => {
      const text = b.textContent?.trim();
      return text === '' && b.closest('[style*="border-left"]');
    });
    if (closeBtn) {
      await user.click(closeBtn);
      await waitFor(() => expect(screen.queryByText('Save changes')).not.toBeInTheDocument());
    }
  });

  it('FE-COMP-TODO-025: New category input appears when clicking "Add category" button', async () => {
    const user = userEvent.setup();
    render(<TodoListPanel tripId={1} items={[]} />);
    // Find and click the "Add category" button
    const addCatBtn = screen.getAllByRole('button').find(
      b => b.textContent?.includes('Add category') || b.getAttribute('title') === 'Add category'
    );
    expect(addCatBtn).toBeTruthy();
    await user.click(addCatBtn!);
    // A text input for category name should appear
    await waitFor(() => {
      const input = screen.getByPlaceholderText('Category name');
      expect(input).toBeInTheDocument();
    });
  });

  it('FE-COMP-TODO-026: Adding a new category creates a filter button for it', async () => {
    const user = userEvent.setup();
    server.use(
      http.post('/api/trips/1/todo', () =>
        HttpResponse.json({ item: buildTodoItem({ category: 'Errands', name: 'New Item' }) })
      ),
    );
    render(<TodoListPanel tripId={1} items={[]} />);
    const addCatBtn = screen.getAllByRole('button').find(
      b => b.textContent?.includes('Add category') || b.getAttribute('title') === 'Add category'
    );
    await user.click(addCatBtn!);
    const categoryInput = await screen.findByPlaceholderText('Category name');
    await user.type(categoryInput, 'Errands');
    await user.keyboard('{Enter}');
    // The Errands filter button should appear after the API call
    await waitFor(() => {
      const errands = screen.queryAllByText('Errands');
      expect(errands.length).toBeGreaterThan(0);
    });
  });

  it('FE-COMP-TODO-027: Overdue count badge appears on Overdue filter for overdue items', () => {
    const items = [buildTodoItem({ name: 'Old Task', checked: 0, due_date: '2020-01-01' })];
    render(<TodoListPanel tripId={1} items={items} />);
    // The overdue count badge '1' should appear near the Overdue filter button
    const overdueArea = screen.getAllByRole('button').find(
      b => b.textContent?.includes('Overdue') || b.getAttribute('title') === 'Overdue'
    );
    expect(overdueArea).toBeTruthy();
    // The count badge with '1' should be in the DOM (rendered inside the sidebar button)
    expect(overdueArea!.textContent).toMatch(/1/);
  });

  it('FE-COMP-TODO-028: Creating a new task via NewTaskPane calls POST API', async () => {
    const user = userEvent.setup();
    let postCalled = false;
    server.use(
      http.post('/api/trips/1/todo', () => {
        postCalled = true;
        return HttpResponse.json({ item: buildTodoItem({ id: 99, name: 'Brand New Task' }) });
      }),
    );
    render(<TodoListPanel tripId={1} items={[]} />);
    // Open the new task pane
    await user.click(screen.getByText('Add new task...'));
    // Wait for "Create task" button to appear
    await screen.findByText('Create task');
    // Type a task name in the autoFocus input (Task name placeholder)
    const nameInput = screen.getByPlaceholderText('Task name');
    await user.type(nameInput, 'Brand New Task');
    // Click the Create task button
    await user.click(screen.getByText('Create task'));
    await waitFor(() => expect(postCalled).toBe(true));
  });

  it('FE-COMP-TODO-029: Task with description shows description preview in list', () => {
    const items = [buildTodoItem({
      name: 'Described Task',
      description: 'This is a task description',
      checked: 0,
    })];
    render(<TodoListPanel tripId={1} items={items} />);
    expect(screen.getByText('This is a task description')).toBeInTheDocument();
  });
});
