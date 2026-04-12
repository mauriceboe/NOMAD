// FE-UTIL-STRIPMD-001 to FE-UTIL-STRIPMD-006

import { describe, it, expect } from 'vitest';
import { stripMarkdown } from './stripMarkdown';

describe('stripMarkdown', () => {
  it('FE-UTIL-STRIPMD-001: strips bold and italic formatting', () => {
    expect(stripMarkdown('**bold** and _italic_')).toBe('bold and italic');
    expect(stripMarkdown('__also bold__ and *also italic*')).toBe('also bold and also italic');
  });

  it('FE-UTIL-STRIPMD-002: strips headings', () => {
    expect(stripMarkdown('# Heading 1')).toBe('Heading 1');
    expect(stripMarkdown('## Heading 2')).toBe('Heading 2');
    expect(stripMarkdown('### Heading 3')).toBe('Heading 3');
  });

  it('FE-UTIL-STRIPMD-003: converts links to text and removes images', () => {
    expect(stripMarkdown('[click here](https://example.com)')).toBe('click here');
    expect(stripMarkdown('![alt text](image.jpg)')).toBe('');
  });

  it('FE-UTIL-STRIPMD-004: strips code blocks and inline code', () => {
    expect(stripMarkdown('use `console.log`')).toBe('use console.log');
    expect(stripMarkdown('```\ncode block\n```')).toBe('');
  });

  it('FE-UTIL-STRIPMD-005: strips blockquotes and lists', () => {
    expect(stripMarkdown('> quoted text')).toBe('quoted text');
    expect(stripMarkdown('- item one')).toBe('item one');
    expect(stripMarkdown('1. first item')).toBe('first item');
  });

  it('FE-UTIL-STRIPMD-006: strips strikethrough and horizontal rules', () => {
    expect(stripMarkdown('~~deleted~~')).toBe('deleted');
    expect(stripMarkdown('---')).toBe('');
  });
});
