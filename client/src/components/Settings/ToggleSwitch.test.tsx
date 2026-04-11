import React from 'react';
import { render, screen } from '../../../tests/helpers/render';
import userEvent from '@testing-library/user-event';
import { resetAllStores } from '../../../tests/helpers/store';
import ToggleSwitch from './ToggleSwitch';

beforeEach(() => {
  resetAllStores();
  vi.clearAllMocks();
});

describe('ToggleSwitch', () => {
  it('FE-COMP-TOGGLESWITCH-001: renders a button', () => {
    render(<ToggleSwitch on={false} onToggle={() => {}} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('FE-COMP-TOGGLESWITCH-002: knob is positioned left when on is false', () => {
    render(<ToggleSwitch on={false} onToggle={() => {}} />);
    const button = screen.getByRole('button');
    const knob = button.querySelector('span')!;
    expect(knob.style.left).toBe('2px');
  });

  it('FE-COMP-TOGGLESWITCH-003: knob is positioned right when on is true', () => {
    render(<ToggleSwitch on={true} onToggle={() => {}} />);
    const button = screen.getByRole('button');
    const knob = button.querySelector('span')!;
    expect(knob.style.left).toBe('22px');
  });

  it('FE-COMP-TOGGLESWITCH-004: background uses accent variable when on is true', () => {
    render(<ToggleSwitch on={true} onToggle={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.style.background).toContain('var(--accent');
  });

  it('FE-COMP-TOGGLESWITCH-005: background uses border-primary variable when on is false', () => {
    render(<ToggleSwitch on={false} onToggle={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.style.background).toContain('var(--border-primary');
  });

  it('FE-COMP-TOGGLESWITCH-006: clicking the button calls onToggle', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(<ToggleSwitch on={false} onToggle={onToggle} />);
    await user.click(screen.getByRole('button'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('FE-COMP-TOGGLESWITCH-007: clicking does not change visual state without parent update', async () => {
    const user = userEvent.setup();
    render(<ToggleSwitch on={false} onToggle={() => {}} />);
    const button = screen.getByRole('button');
    await user.click(button);
    expect(button.querySelector('span')!.style.left).toBe('2px');
  });

  it('FE-COMP-TOGGLESWITCH-008: re-renders correctly when on prop changes from false to true', () => {
    const { rerender } = render(<ToggleSwitch on={false} onToggle={() => {}} />);
    const button = screen.getByRole('button');
    expect(button.querySelector('span')!.style.left).toBe('2px');
    rerender(<ToggleSwitch on={true} onToggle={() => {}} />);
    expect(button.querySelector('span')!.style.left).toBe('22px');
  });
});
