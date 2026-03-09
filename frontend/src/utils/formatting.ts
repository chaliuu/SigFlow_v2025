/* ------------------------------------------------------------------ */
/*  SigFlow – formatting helpers                                       */
/* ------------------------------------------------------------------ */

/** Format a number in exponential notation with `f` fractional digits. */
export function expo(x: number | string, f: number): string {
  return Number.parseFloat(String(x)).toExponential(f);
}

/** Sanitize LaTeX text for width estimation. */
export function sanitizeLatexText(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/\\frac/g, 'frac')
    .replace(/\\[a-zA-Z]+/g, 'A')
    .replace(/[{}^_]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Convert SymPy variable names to LaTeX subscript notation. */
export function convertToLatex(sympy: string): string {
  if (sympy.length === 2) {
    if (/[a-z]/i.test(sympy[0]) && !isNaN(Number(sympy[1]))) {
      return `${sympy[0]}_{${sympy[1]}}`;
    }
    return sympy;
  }
  return sympy.replace(/_/g, '_{');
}

/** Re-invoke MathJax typesetting (safe no-op if not loaded). */
export function typesetMath(): void {
  if (window.MathJax && typeof window.MathJax.typeset === 'function') {
    window.MathJax.typeset();
  }
}

/** Decode an ArrayBuffer trying UTF-16 then UTF-8. */
export function decodeBufferText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const hasUtf16Le =
    bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe;
  const isSimilarUtf16Le =
    bytes.length >= 4 && bytes[1] === 0x00 && bytes[3] === 0x00;
  const hasUtf16Be =
    bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff;

  if (hasUtf16Le || isSimilarUtf16Le) {
    return new TextDecoder('utf-16le').decode(buffer);
  }
  if (hasUtf16Be) {
    return new TextDecoder('utf-16be').decode(buffer);
  }
  return new TextDecoder('utf-8').decode(buffer);
}
