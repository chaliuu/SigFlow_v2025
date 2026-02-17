import sympy
import re
#import sympy as sp
'''from sympy.parsing.sympy_parser import (
    parse_expr,
    standard_transformations
)'''
from sympy.parsing.latex import parse_latex
from sympy import latex

def latex_symbol_tokens(latex_str: str) -> list[str]:
    """
    Extract candidate 'symbols' from a LaTeX expression without parsing math.
    Returns tokens like: ["R_{2}", "RD_{2}", "C_{2}", "G_{M2}", "R_{O M1}", ...]
    """
    s = latex_str

    # Remove common LaTeX commands that are not identifiers
    s = re.sub(r"\\(frac|cdot|left|right|times|cdots|sum|prod|sqrt)\b", " ", s)

    # Pattern: word with optional subscript in braces or plain _<word>
    # Examples: RD_{2}, C_{2}, R_{O M1}, R_{\pi M2}, G_{M2}, s
    token_re = re.compile(
        r"""
        (?<!\\)                # not preceded by backslash (avoid commands)
        ([A-Za-z]+)            # base letters, e.g. RD, C, R, G
        (?:_                   # optional subscript part
            (?:\{([^}]*)\}     #   _{...}
             |([A-Za-z0-9]+)   #   _abc or _2
            )
        )?
        """,
        re.VERBOSE,
    )

    tokens = []
    for m in token_re.finditer(s):
        base = m.group(1)
        sub_braced = m.group(2)
        sub_plain = m.group(3)
        if sub_braced is not None:
            tokens.append(f"{base}_{{{sub_braced}}}")
        elif sub_plain is not None:
            tokens.append(f"{base}_{{{sub_plain}}}")  # normalize to braced
        else:
            tokens.append(base)

    return tokens

def normalize_latex_token(tok: str) -> str:
    """
    Convert LaTeX-ish token like 'RD_{2}' or 'R_{O M1}' or 'G_{M2}' into:
      RD2, R_O_M1, G_M2, R_PI_M2, C2, R2, etc.
    """
    # tok is like "RD_{2}" or "R_{O M1}" or "s"
    if "_{" not in tok:
        # plain symbol like s
        return tok.strip()

    base, sub = tok.split("_{", 1)
    sub = sub[:-1]  # drop trailing "}"
    base = base.strip()
    sub = sub.strip()

    # remove spaces and LaTeX backslashes inside subscript
    sub = re.sub(r"\s+", "", sub)
    sub = sub.replace("\\", "")
    sub = sub.replace("π", "PI").replace("pi", "PI")

    # Common pattern: single numeric subscript -> concat (C_{2} -> C2, RD_{2} -> RD2, R_{2} -> R2)
    if sub.isdigit():
        return f"{base}{sub}"

    # If base has multiple letters like RD and sub is digit, already handled.
    # If sub looks like M2 -> make base + _ + M2 for known forms like G_{M2}
    # We'll convert: G_{M2} -> G_M2
    if re.fullmatch(r"M\d+", sub):
        return f"{base}_M{sub[1:]}"

    # Convert: R_{OM1} or R_{OM2} -> R_O_M1/2
    if re.fullmatch(r"OM\d+", sub):
        return f"{base}_O_M{sub[-1]}"

    # Convert: R_{PIM1} etc -> R_PI_M1
    if re.fullmatch(r"PIM\d+", sub):
        return f"{base}_PI_M{sub[-1]}"

    # Convert: R_{\pi M2} -> R_PI_M2 (after slash removal it'll be piM2 or PIM2 depending)
    if re.fullmatch(r"PI?M\d+", sub):  # handles "PIM2" or "PIM2" after cleanup
        # If it's "PIM2" it matches above; if it's "PIM2" ok; if it's "PIM2" etc
        m = re.search(r"M(\d+)$", sub)
        if m:
            return f"{base}_PI_M{m.group(1)}"

    # Fallback: join with underscore (keeps structure)
    return f"{base}_{sub}"

def correlate_params_from_latex(latex_str: str, allowed_params: set[str]):
    tokens = latex_symbol_tokens(latex_str)
    normalized = [normalize_latex_token(t) for t in tokens]

    # Ignore Laplace variable and common math words if you want
    ignore = {"s", "t", "j", "omega"}
    used = {n for n in normalized if n not in ignore}

    found = sorted(p for p in used if p in allowed_params)
    unknown = sorted(p for p in used if p not in allowed_params)

    return found, unknown

def _extract_braced(s: str, i: int):
    """Given s and index i pointing at '{', return (content, next_index_after_closing_brace)."""
    assert i < len(s) and s[i] == "{"
    depth = 0
    start = i + 1
    i += 1
    while i < len(s):
        if s[i] == "{":
            depth += 1
        elif s[i] == "}":
            if depth == 0:
                return s[start:i], i + 1
            depth -= 1
        i += 1
    return jsonify(error=f"Unmatched '{{' in input"), 400


def latex_frac_to_infix(s: str) -> str:
    """
    Convert \frac{A}{B} into (A)/(B), handling nesting.
    """
    out = []
    i = 0
    while i < len(s):
        if s.startswith(r"\frac", i):
            i += len(r"\frac")
            # expect {numerator}{denominator}
            if i >= len(s) or s[i] != "{":
                out.append(r"\frac")
                continue
            num, i = _extract_braced(s, i)
            if i >= len(s) or s[i] != "{":
                # malformed; keep as-is
                out.append(f"({num})")
                continue
            den, i = _extract_braced(s, i)

            # recursively convert nested fracs inside num/den
            num = latex_frac_to_infix(num)
            den = latex_frac_to_infix(den)

            out.append(f"({num})/({den})")
        else:
            out.append(s[i])
            i += 1
    return "".join(out)

def insert_implicit_mul(expr: str) -> str:
    """
    Insert '*' between adjacent 'atoms' (identifiers, numbers, ')') and
    following atoms ('(', identifiers, numbers), without breaking identifiers like R2 or RD2.
    """
    # Tokenize: identifiers (with underscores), numbers, operators/parens
    tokens = re.findall(r"[A-Za-z_][A-Za-z0-9_]*|\d+\.\d+|\d+|[()+\-*/]", expr)

    def is_atom(tok: str) -> bool:
        return re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*|\d+\.\d+|\d+", tok) is not None

    out = []
    for i, tok in enumerate(tokens):
        if out:
            prev = out[-1]

            prev_is_end_atom = is_atom(prev) or prev == ")"
            tok_is_start_atom = is_atom(tok) or tok == "("

            # Insert '*' for: atom atom, atom (, ) atom, ) (
            if prev_is_end_atom and tok_is_start_atom:
                out.append("*")

        out.append(tok)

    return "".join(out)


def split_concatenated_idents(expr: str, allowed_params: set[str]) -> str:
    """
    Turn 'C2R2RD2s' into 'C2*R2*RD2*s' using allowed_params + {'s'}.
    Only affects long alphabetic/underscore identifiers; leaves numbers/operators alone.
    """
    vocab = set(allowed_params) | {"s"}  # include Laplace variable
    # prefer longer names first
    vocab_sorted = sorted(vocab, key=len, reverse=True)

    tokens = re.findall(r"[A-Za-z_][A-Za-z0-9_]*|\d+\.\d+|\d+|[()+\-*/]", expr)

    def segment(word: str) -> list[str] | None:
        i = 0
        out = []
        while i < len(word):
            match = None
            for v in vocab_sorted:
                if word.startswith(v, i):
                    match = v
                    break
            if match is None:
                return None
            out.append(match)
            i += len(match)
        return out

    out = []
    for tok in tokens:
        if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", tok):
            parts = segment(tok)
            if parts and len(parts) > 1:
                out.append("*".join(parts))
            else:
                out.append(tok)
        else:
            out.append(tok)

    return "".join(out)



def rewrite_symbolic_to_canonical(latex_str: str, allowed_params: set[str]) -> str:
    original = latex_str.replace("\\\\", "\\")
    s = original.replace(r"\left", "").replace(r"\right", "")

    # 1) \frac{A}{B} -> (A)/(B)
    s = latex_frac_to_infix(s)

    # 2) Replace LaTeX tokens with canonical param names
    toks = latex_symbol_tokens(original)
    mapping = {}
    for t in toks:
        norm = normalize_latex_token(t)
        if norm in {"s", "t", "j", "omega"}:
            continue
        if norm in allowed_params:
            mapping[t] = norm

    for t in sorted(mapping.keys(), key=len, reverse=True):
        s = s.replace(t, mapping[t])
        s = s.replace(t.replace("_{", "_").replace("}", ""), mapping[t])

    # 3) Remove leftover braces/spaces
    s = s.replace("{", "").replace("}", "").replace(" ", "")

    # 4) Split concatenations like C2R2RD2s using allowed params
    s = split_concatenated_idents(s, allowed_params)

    # 5) Finally insert '*' for cases like ')(' or 'R2(' etc.
    s = insert_implicit_mul(s)

    return s
