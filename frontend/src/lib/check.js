// Correction du mode écriture.

export function normalize(s) {
  return s.trim().replace(/\s+/g, " ").replace(/[’‘`´]/g, "'").toLowerCase();
}

// Plusieurs réponses acceptées si séparées par "/" ou ";" (ex. "car / automobile").
export function alternatives(expected) {
  return expected.split(/\s*[/;]\s*/).map((s) => s.trim()).filter(Boolean);
}

// Alignement de Levenshtein entre la saisie et la réponse attendue.
// Chaque opération colore une lettre :
//  c = correcte, w = mauvaise lettre, x = lettre en trop, m = lettre manquante.
export function diff(typed, expected) {
  const a = [...typed];
  const b = [...expected];
  const n = a.length;
  const m = b.length;
  const d = Array.from({ length: n + 1 }, (_, i) => [i, ...Array(m).fill(0)]);
  for (let j = 1; j <= m; j++) d[0][j] = j;
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      d[i][j] = Math.min(
        d[i - 1][j] + 1,
        d[i][j - 1] + 1,
        d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  const ops = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i][j] === d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)) {
      ops.push({ t: a[i - 1] === b[j - 1] ? "c" : "w", ch: a[i - 1] });
      i--;
      j--;
    } else if (i > 0 && d[i][j] === d[i - 1][j] + 1) {
      ops.push({ t: "x", ch: a[i - 1] });
      i--;
    } else {
      ops.push({ t: "m", ch: b[j - 1] });
      j--;
    }
  }
  return { distance: d[n][m], ops: ops.reverse() };
}

export function checkAnswer(typed, expected) {
  const t = normalize(typed);
  let best = null;
  for (const alt of alternatives(expected)) {
    const r = diff(t, normalize(alt));
    if (!best || r.distance < best.distance) best = { ...r, target: alt };
  }
  return { correct: best.distance === 0, ...best };
}
