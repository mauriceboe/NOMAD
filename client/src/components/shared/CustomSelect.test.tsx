import { render, screen, fireEvent } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import CustomSelect from './CustomSelect';

const OPTIONS = [
  { value: 'apple', label: 'Apple' },
  { value: 'banana', label: 'Banana' },
  { value: 'cherry', label: 'Cherry' },
];

describe('CustomSelect', () => {
  const onChange = vi.fn();

  beforeEach(() => {
    onChange.mockClear();
  });

  it('FE-COMP-SELECT-001: renders placeholder when no value is selected', () => {
    render(<CustomSelect value="" onChange={onChange} options={OPTIONS} placeholder="Pick a fruit" />);
    expect(screen.getByText('Pick a fruit')).toBeTruthy();
  });

  it('FE-COMP-SELECT-002: renders the selected option label', () => {
    render(<CustomSelect value="banana" onChange={onChange} options={OPTIONS} placeholder="Pick" />);
    expect(screen.getByText('Banana')).toBeTruthy();
  });

  it('FE-COMP-SELECT-003: clicking trigger opens the dropdown', async () => {
    const user = userEvent.setup();
    render(<CustomSelect value="" onChange={onChange} options={OPTIONS} />);
    const trigger = screen.getByRole('button');
    await user.click(trigger);
    // All options should now be visible in the portal
    expect(screen.getByText('Apple')).toBeTruthy();
    expect(screen.getByText('Banana')).toBeTruthy();
    expect(screen.getByText('Cherry')).toBeTruthy();
  });

  it('FE-COMP-SELECT-004: options are displayed in the dropdown', async () => {
    const user = userEvent.setup();
    render(<CustomSelect value="" onChange={onChange} options={OPTIONS} />);
    await user.click(screen.getByRole('button'));
    expect(screen.getAllByRole('button').length).toBeGreaterThan(1); // trigger + option buttons
  });

  it('FE-COMP-SELECT-005: clicking an option calls onChange with correct value', async () => {
    const user = userEvent.setup();
    render(<CustomSelect value="" onChange={onChange} options={OPTIONS} />);
    await user.click(screen.getByRole('button')); // open
    // Options in dropdown are also buttons
    const optionBtns = screen.getAllByRole('button');
    // Find the Cherry option button (not the trigger which shows placeholder)
    const cherryBtn = optionBtns.find(b => b.textContent?.includes('Cherry'));
    await user.click(cherryBtn!);
    expect(onChange).toHaveBeenCalledWith('cherry');
  });

  it('FE-COMP-SELECT-006: clicking an option closes the dropdown', async () => {
    const user = userEvent.setup();
    render(<CustomSelect value="" onChange={onChange} options={OPTIONS} />);
    await user.click(screen.getByRole('button')); // open
    const optionBtns = screen.getAllByRole('button');
    const appleBtn = optionBtns.find(b => b.textContent?.includes('Apple'));
    await user.click(appleBtn!);
    // After selection, only the trigger button remains in DOM
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('FE-COMP-SELECT-007: searchable mode filters options by typed text', async () => {
    const user = userEvent.setup();
    render(<CustomSelect value="" onChange={onChange} options={OPTIONS} searchable={true} />);
    await user.click(screen.getByRole('button')); // open

    const searchInput = screen.getByPlaceholderText('...');
    await user.type(searchInput, 'ban');

    // Only Banana should remain, Apple and Cherry should be filtered out
    expect(screen.getByText('Banana')).toBeTruthy();
    expect(screen.queryByText('Apple')).toBeNull();
    expect(screen.queryByText('Cherry')).toBeNull();
  });

  it('FE-COMP-SELECT-008: disabled state prevents the dropdown from opening', async () => {
    const user = userEvent.setup();
    render(<CustomSelect value="" onChange={onChange} options={OPTIONS} disabled={true} placeholder="Pick" />);
    const trigger = screen.getByRole('button');
    await user.click(trigger);
    // Dropdown should not be in the DOM — options remain hidden
    expect(screen.queryByText('Apple')).toBeNull();
  });
});
