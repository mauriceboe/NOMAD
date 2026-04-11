import { render, screen, fireEvent, act } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import CustomTimePicker from './CustomTimePicker';
import { useSettingsStore } from '../../store/settingsStore';
import { seedStore, resetAllStores } from '../../../tests/helpers/store';
import { buildSettings } from '../../../tests/helpers/factories';

describe('CustomTimePicker', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    resetAllStores();
    seedStore(useSettingsStore, { settings: buildSettings({ time_format: '24h' }) });
  });

  it('FE-COMP-TIMEPICKER-001: renders without crashing', () => {
    render(<CustomTimePicker value="" onChange={onChange} />);
    expect(document.body).toBeTruthy();
  });

  it('FE-COMP-TIMEPICKER-002: shows value in text input in 24h format', () => {
    render(<CustomTimePicker value="14:30" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveProperty('value', '14:30');
  });

  it('FE-COMP-TIMEPICKER-003: shows value in 12h format', () => {
    seedStore(useSettingsStore, { settings: buildSettings({ time_format: '12h' }) });
    render(<CustomTimePicker value="14:30" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    expect(input).toHaveProperty('value', '2:30 PM');
  });

  it('FE-COMP-TIMEPICKER-004: shows raw value while focused', async () => {
    seedStore(useSettingsStore, { settings: buildSettings({ time_format: '12h' }) });
    render(<CustomTimePicker value="14:30" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    await userEvent.setup().click(input);
    expect(input).toHaveProperty('value', '14:30');
  });

  it('FE-COMP-TIMEPICKER-005: clicking clock icon opens dropdown', async () => {
    const user = userEvent.setup();
    render(<CustomTimePicker value="10:00" onChange={onChange} />);
    const clockBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === '');
    await user.click(clockBtn!);
    // Dropdown should show hour and minute display boxes with "10" and "00"
    expect(screen.getByText('10')).toBeTruthy();
    expect(screen.getByText('00')).toBeTruthy();
  });

  it('FE-COMP-TIMEPICKER-006: hour increment button increases hour', async () => {
    const user = userEvent.setup();
    render(<CustomTimePicker value="10:00" onChange={onChange} />);
    // Open dropdown
    const clockBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === '');
    await user.click(clockBtn!);
    // The first empty button inside the dropdown is the hour up chevron
    const chevrons = screen.getAllByRole('button').filter(b => b.textContent?.trim() === '');
    // chevrons[0] is the clock icon, chevrons after that are up/down for hour, up/down for minute
    await user.click(chevrons[1]); // hour up
    expect(onChange).toHaveBeenCalledWith('11:00');
  });

  it('FE-COMP-TIMEPICKER-007: hour decrement button decreases hour', async () => {
    const user = userEvent.setup();
    render(<CustomTimePicker value="10:00" onChange={onChange} />);
    const clockBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === '');
    await user.click(clockBtn!);
    const chevrons = screen.getAllByRole('button').filter(b => b.textContent?.trim() === '');
    await user.click(chevrons[2]); // hour down
    expect(onChange).toHaveBeenCalledWith('09:00');
  });

  it('FE-COMP-TIMEPICKER-008: minute increment steps by 5', async () => {
    const user = userEvent.setup();
    render(<CustomTimePicker value="10:00" onChange={onChange} />);
    const clockBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === '');
    await user.click(clockBtn!);
    const chevrons = screen.getAllByRole('button').filter(b => b.textContent?.trim() === '');
    await user.click(chevrons[3]); // minute up
    expect(onChange).toHaveBeenCalledWith('10:05');
  });

  it('FE-COMP-TIMEPICKER-009: minute increment wraps and carries hour', async () => {
    const user = userEvent.setup();
    render(<CustomTimePicker value="10:55" onChange={onChange} />);
    const clockBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === '');
    await user.click(clockBtn!);
    const chevrons = screen.getAllByRole('button').filter(b => b.textContent?.trim() === '');
    await user.click(chevrons[3]); // minute up
    expect(onChange).toHaveBeenCalledWith('11:00');
  });

  it('FE-COMP-TIMEPICKER-010: hour wraps at 23→0', async () => {
    const user = userEvent.setup();
    render(<CustomTimePicker value="23:00" onChange={onChange} />);
    const clockBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === '');
    await user.click(clockBtn!);
    const chevrons = screen.getAllByRole('button').filter(b => b.textContent?.trim() === '');
    await user.click(chevrons[1]); // hour up
    expect(onChange).toHaveBeenCalledWith('00:00');
  });

  it('FE-COMP-TIMEPICKER-011: clear button calls onChange with empty string', async () => {
    const user = userEvent.setup();
    render(<CustomTimePicker value="10:30" onChange={onChange} />);
    const clockBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === '');
    await user.click(clockBtn!);
    const clearBtn = screen.getByText('✕');
    await user.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('FE-COMP-TIMEPICKER-012: clear button absent when no value', async () => {
    const user = userEvent.setup();
    render(<CustomTimePicker value="" onChange={onChange} />);
    const clockBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === '');
    await user.click(clockBtn!);
    expect(screen.queryByText('✕')).toBeNull();
  });

  it('FE-COMP-TIMEPICKER-013: AM/PM toggle shown in 12h mode', async () => {
    seedStore(useSettingsStore, { settings: buildSettings({ time_format: '12h' }) });
    const user = userEvent.setup();
    render(<CustomTimePicker value="14:00" onChange={onChange} />);
    const clockBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === '');
    await user.click(clockBtn!);
    expect(screen.getByText('PM')).toBeTruthy();
  });

  it('FE-COMP-TIMEPICKER-014: AM/PM toggle hidden in 24h mode', async () => {
    const user = userEvent.setup();
    render(<CustomTimePicker value="14:00" onChange={onChange} />);
    const clockBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === '');
    await user.click(clockBtn!);
    expect(screen.queryByText('AM')).toBeNull();
    expect(screen.queryByText('PM')).toBeNull();
  });

  it('FE-COMP-TIMEPICKER-015: AM/PM toggle switches hour', async () => {
    seedStore(useSettingsStore, { settings: buildSettings({ time_format: '12h' }) });
    const user = userEvent.setup();
    render(<CustomTimePicker value="14:00" onChange={onChange} />);
    const clockBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === '');
    await user.click(clockBtn!);
    // In 12h mode with value "14:00", there are AM/PM chevrons after hour and minute chevrons
    const chevrons = screen.getAllByRole('button').filter(b => b.textContent?.trim() === '');
    // chevrons: [0]=clock, [1]=hour up, [2]=hour down, [3]=min up, [4]=min down, [5]=ampm up, [6]=ampm down
    await user.click(chevrons[5]); // AM/PM toggle
    expect(onChange).toHaveBeenCalledWith('02:00');
  });

  it('FE-COMP-TIMEPICKER-016: blur normalizes HH:MM input', () => {
    // "9:05" matches /^\d{1,2}:\d{2}$/ and normalizes the hour to zero-padded
    render(<CustomTimePicker value="9:05" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('09:05');
  });

  it('FE-COMP-TIMEPICKER-017: blur normalizes 4-digit HHMM input', () => {
    render(<CustomTimePicker value="1430" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('14:30');
  });

  it('FE-COMP-TIMEPICKER-018: blur normalizes bare hour', () => {
    render(<CustomTimePicker value="8" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('08:00');
  });

  it('FE-COMP-TIMEPICKER-019: blur normalizes 12h string "5:30 PM"', () => {
    seedStore(useSettingsStore, { settings: buildSettings({ time_format: '12h' }) });
    render(<CustomTimePicker value="5:30 PM" onChange={onChange} />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('17:30');
  });

  it('FE-COMP-TIMEPICKER-020: clicking outside dropdown closes it', async () => {
    const user = userEvent.setup();
    render(<CustomTimePicker value="10:00" onChange={onChange} />);
    const clockBtn = screen.getAllByRole('button').find(b => b.textContent?.trim() === '');
    await user.click(clockBtn!);
    // Verify dropdown is open
    expect(screen.getByText('10')).toBeTruthy();
    // Click outside
    const outsideEl = document.createElement('div');
    document.body.appendChild(outsideEl);
    await act(async () => {
      fireEvent.mouseDown(outsideEl);
    });
    document.body.removeChild(outsideEl);
    // Hour display should be gone (only visible in dropdown)
    const allText = Array.from(document.querySelectorAll('div')).map(d => d.textContent);
    // The "10" in the dropdown display box should no longer be rendered as a standalone element
    expect(screen.queryByText('✕')).toBeNull(); // clear button gone = dropdown closed
  });
});
