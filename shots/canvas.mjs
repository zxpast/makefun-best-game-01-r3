// A minimal software canvas in plain Node: enough of the 2D context API for
// ROADWARD's renderer (rects, paths, arcs, lines, text) and nothing else.
// The game draws the same way in the browser; this backend only exists so
// screenshots can be rendered where no browser is installed.

import { glyph, textWidth } from './font.mjs';

function parseColor(s) {
  if (typeof s !== 'string') return [0, 0, 0, 1];
  if (s[0] === '#') {
    const h = s.slice(1);
    if (h.length === 3) {
      return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16), 1];
    }
    if (h.length === 6) {
      return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 1];
    }
    if (h.length === 8) {
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
        parseInt(h.slice(6, 8), 16) / 255,
      ];
    }
  }
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const parts = m[1].split(',').map((v) => parseFloat(v));
    return [parts[0] | 0, parts[1] | 0, parts[2] | 0, parts.length > 3 ? parts[3] : 1];
  }
  return [0, 0, 0, 1];
}

function matIdentity() {
  return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
}

function matMul(m, n) {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

function matApply(m, x, y) {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f };
}

export class SoftCanvas {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.buf = new Uint8Array(width * height * 3);
    this._resetState();
    this._stack = [];
    this._path = [];
    this._pathClosed = false;
  }

  _resetState() {
    this._mat = matIdentity();
    this._fill = [0, 0, 0, 1];
    this._stroke = [0, 0, 0, 1];
    this._alpha = 1;
    this._lineWidth = 1;
    this._font = '10px sans-serif';
    this._textAlign = 'left';
    this._textBaseline = 'alphabetic';
  }

  set fillStyle(v) { this._fill = parseColor(v); }
  get fillStyle() { return this._fill; }
  set strokeStyle(v) { this._stroke = parseColor(v); }
  get strokeStyle() { return this._stroke; }
  set globalAlpha(v) { this._alpha = v; }
  get globalAlpha() { return this._alpha; }
  set lineWidth(v) { this._lineWidth = v; }
  get lineWidth() { return this._lineWidth; }
  set font(v) { this._font = v; }
  get font() { return this._font; }
  set textAlign(v) { this._textAlign = v; }
  get textAlign() { return this._textAlign; }
  set textBaseline(v) { this._textBaseline = v; }
  get textBaseline() { return this._textBaseline; }

  save() {
    this._stack.push({
      mat: { ...this._mat },
      fill: this._fill,
      stroke: this._stroke,
      alpha: this._alpha,
      lineWidth: this._lineWidth,
      font: this._font,
      textAlign: this._textAlign,
      textBaseline: this._textBaseline,
    });
  }

  restore() {
    const s = this._stack.pop();
    if (!s) return;
    this._mat = s.mat;
    this._fill = s.fill;
    this._stroke = s.stroke;
    this._alpha = s.alpha;
    this._lineWidth = s.lineWidth;
    this._font = s.font;
    this._textAlign = s.textAlign;
    this._textBaseline = s.textBaseline;
  }

  translate(x, y) {
    this._mat = matMul(this._mat, { a: 1, b: 0, c: 0, d: 1, e: x, f: y });
  }

  rotate(a) {
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    this._mat = matMul(this._mat, { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 });
  }

  scale(x, y) {
    this._mat = matMul(this._mat, { a: x, b: 0, c: 0, d: y, e: 0, f: 0 });
  }

  // ---- raster core ------------------------------------------------------

  _blend(px, py, r, g, b, a) {
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) return;
    if (a <= 0) return;
    const i = (py * this.width + px) * 3;
    if (a >= 1) {
      this.buf[i] = r;
      this.buf[i + 1] = g;
      this.buf[i + 2] = b;
      return;
    }
    this.buf[i] = Math.round(r * a + this.buf[i] * (1 - a));
    this.buf[i + 1] = Math.round(g * a + this.buf[i + 1] * (1 - a));
    this.buf[i + 2] = Math.round(b * a + this.buf[i + 2] * (1 - a));
  }

  _fillRectPixels(x0, y0, x1, y1, color, alpha) {
    const [r, g, b, ca] = color;
    const a = ca * alpha;
    const xa = Math.max(0, Math.floor(Math.min(x0, x1)));
    const xb = Math.min(this.width, Math.ceil(Math.max(x0, x1)));
    const ya = Math.max(0, Math.floor(Math.min(y0, y1)));
    const yb = Math.min(this.height, Math.ceil(Math.max(y0, y1)));
    for (let y = ya; y < yb; y++) {
      for (let x = xa; x < xb; x++) this._blend(x, y, r, g, b, a);
    }
  }

  // Fill a polygon (list of {x,y}, already in device space) with even-odd.
  _fillPoly(pts, color, alpha) {
    if (pts.length < 3) return;
    // Fast path: axis-aligned rectangle.
    if (pts.length === 4) {
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      let axis = true;
      for (const p of pts) {
        if (p.x !== minX && p.x !== maxX) axis = false;
        if (p.y !== minY && p.y !== maxY) axis = false;
      }
      if (axis) {
        this._fillRectPixels(minX, minY, maxX, maxY, color, alpha);
        return;
      }
    }
    let minY = Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.height - 1, Math.ceil(maxY));
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5;
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const q = pts[(i + 1) % pts.length];
        if ((p.y <= yc && q.y > yc) || (q.y <= yc && p.y > yc)) {
          const t = (yc - p.y) / (q.y - p.y);
          xs.push(p.x + t * (q.x - p.x));
        }
      }
      xs.sort((a, b) => a - b);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        this._fillRectPixels(xs[i], y, xs[i + 1], y + 1, color, alpha);
      }
    }
  }

  _strokeSegment(x0, y0, x1, y1) {
    const w = this._lineWidth / 2;
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * w;
    const ny = (dx / len) * w;
    this._fillPoly(
      [
        { x: x0 + nx, y: y0 + ny },
        { x: x1 + nx, y: y1 + ny },
        { x: x1 - nx, y: y1 - ny },
        { x: x0 - nx, y: y0 - ny },
      ],
      this._stroke,
      this._alpha,
    );
  }

  // ---- public API -------------------------------------------------------

  clearRect(x, y, w, h) {
    const p0 = matApply(this._mat, x, y);
    const p1 = matApply(this._mat, x + w, y + h);
    this._fillRectPixels(p0.x, p0.y, p1.x, p1.y, [0, 0, 0, 1], 1);
  }

  fillRect(x, y, w, h) {
    const pts = [
      matApply(this._mat, x, y),
      matApply(this._mat, x + w, y),
      matApply(this._mat, x + w, y + h),
      matApply(this._mat, x, y + h),
    ];
    this._fillPoly(pts, this._fill, this._alpha);
  }

  strokeRect(x, y, w, h) {
    const p0 = matApply(this._mat, x, y);
    const p1 = matApply(this._mat, x + w, y);
    const p2 = matApply(this._mat, x + w, y + h);
    const p3 = matApply(this._mat, x, y + h);
    this._strokeSegment(p0.x, p0.y, p1.x, p1.y);
    this._strokeSegment(p1.x, p1.y, p2.x, p2.y);
    this._strokeSegment(p2.x, p2.y, p3.x, p3.y);
    this._strokeSegment(p3.x, p3.y, p0.x, p0.y);
  }

  beginPath() {
    this._path = [];
    this._pathClosed = false;
  }

  moveTo(x, y) {
    const p = matApply(this._mat, x, y);
    this._path.push({ move: true, x: p.x, y: p.y });
  }

  lineTo(x, y) {
    const p = matApply(this._mat, x, y);
    this._path.push({ move: false, x: p.x, y: p.y });
  }

  arc(x, y, r, start, end, anticlockwise) {
    const steps = Math.max(6, Math.ceil(Math.abs(end - start) / 0.12));
    const dir = anticlockwise ? -1 : 1;
    const total = (end - start) * dir;
    for (let i = 0; i <= steps; i++) {
      const a = start + dir * (total * i) / steps;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) this.moveTo(px, py);
      else this.lineTo(px, py);
    }
  }

  closePath() {
    this._pathClosed = true;
  }

  _subpaths() {
    const subs = [];
    let cur = null;
    for (const pt of this._path) {
      if (pt.move) {
        cur = [{ x: pt.x, y: pt.y }];
        subs.push(cur);
      } else if (cur) {
        cur.push({ x: pt.x, y: pt.y });
      }
    }
    return subs;
  }

  fill() {
    for (const sub of this._subpaths()) {
      this._fillPoly(sub, this._fill, this._alpha);
    }
  }

  stroke() {
    for (const sub of this._subpaths()) {
      for (let i = 0; i + 1 < sub.length; i++) {
        this._strokeSegment(sub[i].x, sub[i].y, sub[i + 1].x, sub[i + 1].y);
      }
      if (this._pathClosed && sub.length > 2) {
        this._strokeSegment(sub[sub.length - 1].x, sub[sub.length - 1].y, sub[0].x, sub[0].y);
      }
    }
  }

  fillText(text, x, y) {
    const size = parseInt((this._font.match(/(\d+)px/) || [0, 10])[1], 10);
    const scale = size / 7;
    const wUnits = textWidth(String(text)) * scale;
    let x0 = x;
    if (this._textAlign === 'center') x0 = x - wUnits / 2;
    else if (this._textAlign === 'right') x0 = x - wUnits;
    let y0 = y;
    if (this._textBaseline === 'middle') y0 = y - size / 2;
    else if (this._textBaseline === 'alphabetic') y0 = y - size * 0.8;
    let cx = x0;
    for (const ch of String(text)) {
      const g = glyph(ch);
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (g[row][col] === '#') {
            const px = cx + col * scale;
            const py = y0 + row * scale;
            const p0 = matApply(this._mat, px, py);
            const p1 = matApply(this._mat, px + Math.max(1, scale), py + Math.max(1, scale));
            this._fillRectPixels(p0.x, p0.y, p1.x, p1.y, this._fill, this._alpha);
          }
        }
      }
      cx += 6 * scale;
    }
  }

  measureText(text) {
    const size = parseInt((this._font.match(/(\d+)px/) || [0, 10])[1], 10);
    return { width: textWidth(String(text)) * (size / 7) };
  }
}
