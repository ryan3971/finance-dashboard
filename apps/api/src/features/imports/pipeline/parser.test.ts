import { describe, expect, it } from 'vitest';
import { parseCsv } from './parser';

// ---------------------------------------------------------------------------
// Basic splitting
// ---------------------------------------------------------------------------
describe('parseCsv — basic splitting', () => {
  it('splits a single-row CSV into columns', () => {
    expect(parseCsv('a,b,c')).toEqual([['a', 'b', 'c']]);
  });

  it('splits multiple rows', () => {
    expect(parseCsv('a,b\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('handles Windows-style CRLF line endings', () => {
    expect(parseCsv('a,b\r\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('returns a single-element array for a row with no commas', () => {
    expect(parseCsv('hello')).toEqual([['hello']]);
  });

  it('preserves an empty field between two commas', () => {
    expect(parseCsv('a,,c')).toEqual([['a', '', 'c']]);
  });

  it('preserves an empty leading field', () => {
    expect(parseCsv(',b,c')).toEqual([['', 'b', 'c']]);
  });

  it('preserves an empty trailing field', () => {
    expect(parseCsv('a,b,')).toEqual([['a', 'b', '']]);
  });
});

// ---------------------------------------------------------------------------
// Quoted fields containing commas
// ---------------------------------------------------------------------------
describe('parseCsv — quoted fields', () => {
  it('treats a comma inside double-quotes as a literal character', () => {
    expect(parseCsv('"a,b",c')).toEqual([['a,b', 'c']]);
  });

  it('strips the surrounding quotes from a quoted field', () => {
    expect(parseCsv('"hello",world')).toEqual([['hello', 'world']]);
  });

  it('handles multiple quoted fields in one row', () => {
    expect(parseCsv('"a,b","c,d"')).toEqual([['a,b', 'c,d']]);
  });

  it('handles a quoted field with multiple commas', () => {
    expect(parseCsv('"one,two,three",end')).toEqual([['one,two,three', 'end']]);
  });

  it('handles quoted field mid-row', () => {
    expect(parseCsv('start,"mid,dle",end')).toEqual([['start', 'mid,dle', 'end']]);
  });

  it('handles a realistic transaction description with an embedded comma', () => {
    expect(parseCsv('2026-04-15,"Coffee, Muffin",12.50')).toEqual([
      ['2026-04-15', 'Coffee, Muffin', '12.50'],
    ]);
  });
});

// ---------------------------------------------------------------------------
// Empty rows / trailing newlines
// ---------------------------------------------------------------------------
describe('parseCsv — empty rows and trailing newlines', () => {
  it('ignores a trailing newline', () => {
    expect(parseCsv('a,b\n')).toEqual([['a', 'b']]);
  });

  it('ignores a trailing CRLF', () => {
    expect(parseCsv('a,b\r\n')).toEqual([['a', 'b']]);
  });

  it('ignores blank lines between data rows', () => {
    expect(parseCsv('a,b\n\nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('ignores whitespace-only lines', () => {
    expect(parseCsv('a,b\n   \nc,d')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  it('returns an empty array for an all-blank input', () => {
    expect(parseCsv('\n\n\n')).toEqual([]);
  });

  it('returns an empty array for an empty string', () => {
    expect(parseCsv('')).toEqual([]);
  });

  it('returns an empty array for a whitespace-only string', () => {
    expect(parseCsv('   ')).toEqual([]);
  });
});
