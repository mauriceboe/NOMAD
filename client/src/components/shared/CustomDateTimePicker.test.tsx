import { render, screen, fireEvent, act } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { CustomDatePicker, CustomDateTimePicker } from './CustomDateTimePicker';
import { useSettingsStore } from '../../store/settingsStore';

// ─── CustomDatePicker ─────────────────────────────────────────────────────────

describe('CustomDatePicker', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('FE-COMP-DATEPICKER-001: renders without crashing', () => {
    render(<CustomDatePicker value="" onChange={onChange} />);
    expect(document.body).toBeTruthy();
  });

  it('FE-COMP-DATEPICKER-002: shows placeholder when no value', () => {
    render(<CustomDatePicker value="" onChange={onChange} placeholder="Start Date" />);
    expect(screen.getByText('Start Date')).toBeTruthy();
  });

  it('FE-COMP-DATEPICKER-003: shows formatted date when value is set', () => {
    render(<CustomDatePicker value="2026-03-15" onChange={onChange} />);
    const btn = screen.getByRole('button');
    // Locale-formatted date should contain "Mar" or "15" or "2026"
    expect(btn.textContent).toMatch(/Mar|15|2026/);
  });

  it('FE-COMP-DATEPICKER-004: clicking button opens calendar portal', async () => {
    const user = userEvent.setup();
    render(<CustomDatePicker value="2026-03-15" onChange={onChange} />);
    await user.click(screen.getByRole('button'));
    const dayBtns = screen.getAllByRole('button').filter(b => /^\d+$/.test(b.textContent?.trim() ?? ''));
    expect(dayBtns.length).toBeGreaterThan(0);
  });

  it('FE-COMP-DATEPICKER-005: clicking a day calls onChange with correct ISO date', async () => {
    const user = userEvent.setup();
    render(<CustomDatePicker value="2026-03-01" onChange={onChange} />);
    await user.click(screen.getByRole('button')); // open March 2026
    const dayBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === '15');
    await user.click(dayBtn!);
    expect(onChange).toHaveBeenCalledWith('2026-03-15');
  });

  it('FE-COMP-DATEPICKER-006: prev month navigation decrements month', async () => {
    const user = userEvent.setup();
    render(<CustomDatePicker value="2026-03-01" onChange={onChange} />);
    await user.click(screen.getByRole('button')); // open March 2026
    // Nav buttons have no text content (only SVG icons)
    const emptyBtns = screen.getAllByRole('button').filter(b => b.textContent?.trim() === '');
    await user.click(emptyBtns[0]); // left chevron = prev month
    expect(screen.getByText(/february 2026/i)).toBeTruthy();
  });

  it('FE-COMP-DATEPICKER-007: next month navigation increments month', async () => {
    const user = userEvent.setup();
    render(<CustomDatePicker value="2026-03-01" onChange={onChange} />);
    await user.click(screen.getByRole('button')); // open March 2026
    const emptyBtns = screen.getAllByRole('button').filter(b => b.textContent?.trim() === '');
    await user.click(emptyBtns[emptyBtns.length - 1]); // right chevron = next month
    expect(screen.getByText(/april 2026/i)).toBeTruthy();
  });

  it('FE-COMP-DATEPICKER-008: clear button calls onChange with empty string', async () => {
    const user = userEvent.setup();
    render(<CustomDatePicker value="2026-03-15" onChange={onChange} />);
    await user.click(screen.getByRole('button')); // open
    const clearBtn = screen.getByText('✕');
    await user.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('FE-COMP-DATEPICKER-009: clear button absent when no value', async () => {
    const user = userEvent.setup();
    render(<CustomDatePicker value="" onChange={onChange} />);
    await user.click(screen.getByRole('button')); // open
    expect(screen.queryByText('✕')).toBeNull();
  });

  it('FE-COMP-DATEPICKER-010: clicking outside calendar closes it', async () => {
    const user = userEvent.setup();
    render(<CustomDatePicker value="2026-03-15" onChange={onChange} />);
    await user.click(screen.getByRole('button')); // open
    // Verify calendar is open (day buttons present)
    expect(screen.getAllByRole('button').filter(b => /^\d+$/.test(b.textContent?.trim() ?? '')).length).toBeGreaterThan(0);
    // Fire mousedown outside both the component div and the portal
    const outsideEl = document.createElement('div');
    document.body.appendChild(outsideEl);
    await act(async () => {
      fireEvent.mouseDown(outsideEl);
    });
    document.body.removeChild(outsideEl);
    // Day buttons should be gone
    expect(screen.getAllByRole('button').filter(b => /^\d+$/.test(b.textContent?.trim() ?? '')).length).toBe(0);
  });

  it('FE-COMP-DATEPICKER-011: double-click activates text input mode', async () => {
    const user = userEvent.setup();
    render(<CustomDatePicker value="" onChange={onChange} />);
    await user.dblClick(screen.getByRole('button'));
    expect(screen.getByPlaceholderText('DD.MM.YYYY')).toBeTruthy();
  });

  it('FE-COMP-DATEPICKER-012: text input accepts ISO format YYYY-MM-DD', async () => {
    const user = userEvent.setup();
    render(<CustomDatePicker value="" onChange={onChange} />);
    await user.dblClick(screen.getByRole('button'));
    const input = screen.getByPlaceholderText('DD.MM.YYYY');
    fireEvent.change(input, { target: { value: '2026-07-04' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('2026-07-04');
  });

  it('FE-COMP-DATEPICKER-013: text input accepts EU format DD.MM.YYYY', async () => {
    const user = userEvent.setup();
    render(<CustomDatePicker value="" onChange={onChange} />);
    await user.dblClick(screen.getByRole('button'));
    const input = screen.getByPlaceholderText('DD.MM.YYYY');
    fireEvent.change(input, { target: { value: '04.07.2026' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('2026-07-04');
  });

  it('FE-COMP-DATEPICKER-014: Escape in text input cancels text mode', async () => {
    const user = userEvent.setup();
    render(<CustomDatePicker value="" onChange={onChange} />);
    await user.dblClick(screen.getByRole('button'));
    const input = screen.getByPlaceholderText('DD.MM.YYYY');
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByPlaceholderText('DD.MM.YYYY')).toBeNull();
    expect(screen.getByRole('button')).toBeTruthy();
  });
});

// ─── CustomDateTimePicker ─────────────────────────────────────────────────────

describe('CustomDateTimePicker', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Use 24h format for predictable time input behavior
    useSettingsStore.setState({
      settings: { ...useSettingsStore.getState().settings, time_format: '24h' },
    });
  });

  it('FE-COMP-DATEPICKER-015: renders date and time pickers side by side', () => {
    render(<CustomDateTimePicker value="" onChange={onChange} />);
    // Date picker renders a trigger button
    expect(screen.getAllByRole('button').length).toBeGreaterThanOrEqual(1);
    // Time picker renders a text input
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('FE-COMP-DATEPICKER-016: setting a date-only value defaults time to 12:00', async () => {
    const user = userEvent.setup();
    render(<CustomDateTimePicker value="" onChange={onChange} />);
    // The date trigger is the first button
    const dateTrigger = screen.getAllByRole('button')[0];
    await user.click(dateTrigger); // open calendar
    // Click day 1
    const day1 = screen.getAllByRole('button').find(b => b.textContent?.trim() === '1');
    await user.click(day1!);
    // onChange should have been called with T12:00 suffix
    expect(onChange).toHaveBeenCalledWith(expect.stringMatching(/T12:00$/));
  });

  it('FE-COMP-DATEPICKER-017: changing time part preserves date part', () => {
    render(<CustomDateTimePicker value="2026-06-01T09:30" onChange={onChange} />);
    const timeInput = screen.getByRole('textbox');
    fireEvent.change(timeInput, { target: { value: '10:00' } });
    expect(onChange).toHaveBeenCalledWith('2026-06-01T10:00');
  });
});
