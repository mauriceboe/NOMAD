// FE-COMP-MDTOOLBAR-001 to FE-COMP-MDTOOLBAR-006

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '../../../tests/helpers/render';
import MarkdownToolbar from './MarkdownToolbar';
import React from 'react';

function createTextareaRef(value = '', selectionStart = 0, selectionEnd = 0) {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.selectionStart = selectionStart;
  textarea.selectionEnd = selectionEnd;
  textarea.focus = vi.fn();
  textarea.setSelectionRange = vi.fn();
  return { current: textarea } as React.RefObject<HTMLTextAreaElement>;
}

describe('MarkdownToolbar', () => {
  let onUpdate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onUpdate = vi.fn();
  });

  it('FE-COMP-MDTOOLBAR-001: renders all 8 toolbar buttons', () => {
    const ref = createTextareaRef();
    render(<MarkdownToolbar textareaRef={ref} onUpdate={onUpdate} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(8);
  });

  it('FE-COMP-MDTOOLBAR-002: buttons have correct title labels', () => {
    const ref = createTextareaRef();
    render(<MarkdownToolbar textareaRef={ref} onUpdate={onUpdate} />);
    expect(screen.getByTitle('Bold')).toBeInTheDocument();
    expect(screen.getByTitle('Italic')).toBeInTheDocument();
    expect(screen.getByTitle('Link')).toBeInTheDocument();
    expect(screen.getByTitle('Heading')).toBeInTheDocument();
    expect(screen.getByTitle('Quote')).toBeInTheDocument();
    expect(screen.getByTitle('List')).toBeInTheDocument();
    expect(screen.getByTitle('Ordered')).toBeInTheDocument();
    expect(screen.getByTitle('Divider')).toBeInTheDocument();
  });

  it('FE-COMP-MDTOOLBAR-003: bold button wraps selected text with **', () => {
    const ref = createTextareaRef('hello world', 6, 11);
    render(<MarkdownToolbar textareaRef={ref} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByTitle('Bold'));
    expect(onUpdate).toHaveBeenCalledWith('hello **world**');
  });

  it('FE-COMP-MDTOOLBAR-004: italic button wraps selected text with _', () => {
    const ref = createTextareaRef('hello world', 6, 11);
    render(<MarkdownToolbar textareaRef={ref} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByTitle('Italic'));
    expect(onUpdate).toHaveBeenCalledWith('hello _world_');
  });

  it('FE-COMP-MDTOOLBAR-005: link button wraps selected text as markdown link', () => {
    const ref = createTextareaRef('click me', 0, 8);
    render(<MarkdownToolbar textareaRef={ref} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByTitle('Link'));
    expect(onUpdate).toHaveBeenCalledWith('[click me](url)');
  });

  it('FE-COMP-MDTOOLBAR-006: heading button inserts line prefix', () => {
    const ref = createTextareaRef('my title', 0, 0);
    render(<MarkdownToolbar textareaRef={ref} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByTitle('Heading'));
    expect(onUpdate).toHaveBeenCalledWith('## my title');
  });
});
