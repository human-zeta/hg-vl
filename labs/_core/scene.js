// Detección de cambio de plano sobre una grilla chica de luminancia.

export function mad(a, b) {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  let s = 0;
  for (let i = 0; i < n; i++) s += Math.abs(a[i] - b[i]);
  return s / n / 255;
}

// 1 = poco sensible (solo cortes fuertes), 10 = se queda con casi todo.
export function thresholdFor(sens) {
  const v = Math.min(10, Math.max(1, Number(sens) || 5));
  return 0.38 - (v / 10) * 0.33;
}

export function sensLabel(sens) {
  const v = Number(sens) || 5;
  if (v <= 3) return 'baja';
  if (v <= 7) return 'media';
  return 'alta';
}

export function lumaGrid(rgba, srcW, srcH, tw = 32, th = 18) {
  const g = new Uint8Array(tw * th);
  const w = srcW | 0;
  const h = srcH | 0;
  if (!w || !h) return g;
  for (let y = 0; y < th; y++) {
    const sy = Math.min(h - 1, ((y + 0.5) * h / th) | 0);
    for (let x = 0; x < tw; x++) {
      const sx = Math.min(w - 1, ((x + 0.5) * w / tw) | 0);
      const i = (sy * w + sx) * 4;
      g[y * tw + x] = (rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114) | 0;
    }
  }
  return g;
}

export function lumaFromImageData(imageData, tw = 32, th = 18) {
  const g = new Uint8Array(tw * th);
  const d = imageData.data;
  const n = Math.min(g.length, (d.length / 4) | 0);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    g[i] = (d[o] * 0.299 + d[o + 1] * 0.587 + d[o + 2] * 0.114) | 0;
  }
  return g;
}

export function shouldKeepScene(prev, cur, t, lastT, threshold, minGap) {
  if (!prev) return true;
  if ((t - lastT) < minGap) return false;
  return mad(prev, cur) >= threshold;
}
