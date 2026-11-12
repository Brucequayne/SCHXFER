// Ordnet Fotos in Reihen gleicher Höhe an, die die volle Breite füllen.
// items: [{ w, h }] – liefert Positionen in Pixeln.
export function justify(items, width, targetHeight, gap) {
  const rows = [];
  let row = [];
  let ratioSum = 0;

  for (const item of items) {
    row.push(item);
    ratioSum += item.w / item.h;
    const h = (width - gap * (row.length - 1)) / ratioSum;
    if (h <= targetHeight) {
      rows.push({ items: row, h });
      row = [];
      ratioSum = 0;
    }
  }
  if (row.length) {
    const h = (width - gap * (row.length - 1)) / ratioSum;
    rows.push({ items: row, h: Math.min(targetHeight, h) });
  }

  const boxes = [];
  let y = 0;
  for (const r of rows) {
    let x = 0;
    for (const item of r.items) {
      const w = (r.h * item.w) / item.h;
      boxes.push({ x, y, w, h: r.h });
      x += w + gap;
    }
    y += r.h + gap;
  }
  return { boxes, height: Math.max(0, y - gap) };
}
