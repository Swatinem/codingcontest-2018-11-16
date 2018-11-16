import { readFileSync, writeFileSync } from "fs";

class Reader {
  private _buf: Array<string>;

  private constructor(buf: string) {
    this._buf = buf.split(/\s+/);
  }

  tok() {
    return this._buf.shift() || "";
  }

  nth(n: number) {
    return this._buf.splice(n, 1) || "";
  }

  num() {
    return Number(this.tok());
  }

  readN<T>(fn: (r: Reader) => T): Array<T> {
    const num = this.num();
    const out: Array<T> = [];
    for (let i = 0; i < num; i++) {
      out.push(fn(this));
    }
    return out;
  }

  static fromFile(file: string) {
    const buf = readFileSync(file, "utf-8");
    return new Reader(buf);
  }

  static fromString(buf: string) {
    return new Reader(buf);
  }
}

type Level = (r: Reader) => string;

function assert(level: Level, input: string | Reader, _expected: string) {
  const r = input instanceof Reader ? input : Reader.fromString(input);
  const actual = level(r).trim();
  const expected = _expected.trim();
  if (actual !== expected) {
    console.error(`
"${level.name}" assertion failed
Expected: ${expected}
Actual: ${actual}
`);
  }
}

function readCase(level: number, ex: number) {
  return Reader.fromFile(`./level${level}/level${level}_${ex}.in`);
}

function processFiles(fun: Level, level: number, examples: number) {
  for (let ex = 0; ex < examples; ex++) {
    const input = readCase(level, ex);
    const output = fun(input);
    writeFileSync(`./level${level}/level${level}_${ex}.out`, output);
  }
}

type Point = [number, number];

class Rect {
  constructor(public tl: Point, public br: Point, public val?: number) {}

  dim(): Point {
    const { tl, br } = this;
    return [br[0] - tl[0] + 1, br[1] - tl[1] + 1];
  }

  containsPoint(p: Point) {
    const { tl, br } = this;
    return p[0] >= tl[0] && p[0] <= br[0] && (p[1] >= tl[1] && p[1] <= br[1]);
  }

  center(): Point {
    const { tl } = this;
    const [w, h] = this.dim();
    return [tl[0] + Math.floor((w - 1) / 2), tl[1] + Math.floor((h - 1) / 2)];
  }
}

class Image {
  private constructor(public dim: Point, private buf: Array<number>) {}

  clone() {
    return new Image(this.dim, this.buf.slice());
  }

  static fromReader(r: Reader) {
    const dim: Point = [r.num(), r.num()];
    const buf = [];
    const len = dim[0] * dim[1];
    for (let i = 0; i < len; i++) {
      buf.push(r.num());
    }
    return new Image(dim, buf);
  }

  debug() {
    const [rows, cols] = this.dim;
    let maxValue = 0;
    for (const val of this.buf) {
      maxValue = Math.max(maxValue, val);
    }
    let output = `P2\n${rows} ${cols}\n${maxValue}\n`;
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let c = 0; c < cols; c++) {
        row.push(this.pxAt([r, c]));
      }
      output += `${row.join(" ")}\n`;
    }
    console.log(output);
  }

  ptToIdx(pt: Point) {
    const [row, col] = pt;
    const [, cols] = this.dim;
    return row * cols + col;
  }
  idxToPt(idx: number): Point {
    const [, cols] = this.dim;
    return [Math.floor(idx / cols), idx % cols];
  }

  pxAt(pt: Point) {
    return this.buf[this.ptToIdx(pt)] || 0;
  }

  findUniqueValues() {
    const uniques = new Set(this.buf);
    uniques.delete(0);
    return [...uniques];
  }

  subImage(min: Point, max: Point): Image {
    const [minrow, mincol] = min;
    const [maxrow, maxcol] = max;
    const buf = [];
    for (let r = minrow; r <= maxrow; r++) {
      for (let c = mincol; c <= maxcol; c++) {
        buf.push(this.pxAt([r, c]));
      }
    }
    const dim: Point = [1 + maxrow - minrow, 1 + maxcol - mincol];
    const image = new Image(dim, buf);

    return image;
  }

  findRects() {
    const rects: Array<Rect> = [];

    for (let i = 0; i < this.buf.length; i++) {
      const val = this.buf[i];
      if (val === 0) {
        continue;
      }
      const p = this.idxToPt(i);
      rects.push(this.getRectFromPoint(p));
    }

    return rects;
  }

  getRectFromPoint(p: Point) {
    const px = this.pxAt(p);

    const tl: Point = [p[0], p[1]];
    const br: Point = [p[0], p[1]];

    // https://en.wikipedia.org/wiki/Flood_fill#Stack-based_recursive_implementation_(four-way)
    const fill = (p: Point) => {
      const val = this.pxAt(p);
      if (val !== px) {
        return;
      }

      this.buf[this.ptToIdx(p)] = 0;

      // expand bbox:
      tl[0] = Math.min(tl[0], p[0]);
      tl[1] = Math.min(tl[1], p[1]);
      br[0] = Math.max(br[0], p[0]);
      br[1] = Math.max(tl[1], p[1]);

      fill([p[0] - 1, p[1]]);
      fill([p[0] + 1, p[1]]);
      fill([p[0], p[1] - 1]);
      fill([p[0], p[1] + 1]);
    };
    fill(p);

    return new Rect(tl, br, px);
  }

  filter(f: Filter): Image {
    const clone = this.clone();
    for (let i = 0; i < this.buf.length; i++) {
      clone.buf[i] = f(this, this.buf[i], this.idxToPt(i));
    }
    return clone;
  }
}

function level1(r: Reader) {
  const grid = Image.fromReader(r);

  const uniques = grid.findUniqueValues();
  uniques.sort((a, b) => a - b);
  if (!uniques.length) {
    return "0";
  }
  return uniques.map(String).join(" ");
}

assert(
  level1,
  `4 6
0 0 1 1 1 0
0 2 0 0 3 3
0 2 0 0 3 3
0 0 1 0 0 0`,
  `1 2 3`,
);

processFiles(level1, 1, 4);

function mid(p: Point): Point {
  return [p[0] + 0.5, p[1] + 0.5];
}

function interp(a: Point, b: Point, d: number) {
  const r = a[0] + d * (b[0] - a[0]);
  const c = a[1] + d * (b[1] - a[1]);
  return [r, c];
}

function level2(r: Reader) {
  const num = r.num();

  let output = "";
  for (let i = 0; i < num; i++) {
    const a = mid([r.num(), r.num()]);
    const b = mid([r.num(), r.num()]);
    const p = interp(a, b, r.num());
    output += `${Math.floor(p[0])} ${Math.floor(p[1])}\n`;
  }
  return output.trim();
}

assert(
  level2,
  `1
0 0 6 2 0.55000`,
  `3 1`,
);

processFiles(level2, 2, 4);

// https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm#Algorithm
type PlotFn = (p: Point) => any;

function plotLineLow(p0: Point, p1: Point, plot: PlotFn) {
  const [x0, y0] = p0;
  const [x1, y1] = p1;
  let dx = x1 - x0;
  let dy = y1 - y0;
  let yi = 1;
  if (dy < 0) {
    yi = -1;
    dy = -dy;
  }
  let D = 2 * dy - dx;
  let y = y0;

  for (let x = x0; x <= x1; x++) {
    plot([x, y]);
    if (D > 0) {
      y = y + yi;
      D = D - 2 * dx;
    }
    D = D + 2 * dy;
  }
}

function plotLineHigh(p0: Point, p1: Point, plot: PlotFn) {
  const [x0, y0] = p0;
  const [x1, y1] = p1;
  let dx = x1 - x0;
  let dy = y1 - y0;
  let xi = 1;
  if (dx < 0) {
    xi = -1;
    dx = -dx;
  }
  let D = 2 * dx - dy;
  let x = x0;

  for (let y = y0; y <= y1; y++) {
    plot([x, y]);
    if (D > 0) {
      x = x + xi;
      D = D - 2 * dy;
    }
    D = D + 2 * dx;
  }
}

function plotLine(p0: Point, p1: Point, plot: PlotFn) {
  const [x0, y0] = p0;
  const [x1, y1] = p1;
  if (Math.abs(y1 - y0) < Math.abs(x1 - x0)) {
    if (x0 > x1) plotLineLow([x1, y1], [x0, y0], plot);
    else plotLineLow([x0, y0], [x1, y1], plot);
  } else {
    if (y0 > y1) plotLineHigh([x1, y1], [x0, y0], plot);
    else plotLineHigh([x0, y0], [x1, y1], plot);
  }
}

class Line {
  constructor(public p0: Point, public p1: Point) {}

  static fromReader(r: Reader) {
    return new Line([r.num(), r.num()], [r.num(), r.num()]);
  }

  pointsOnLine() {
    const { p0, p1 } = this;
    const points: Array<Point> = [];
    plotLine(p0, p1, p => points.push(p));
    return points;
  }
}

function level3(r: Reader) {
  const lines = r.readN(Line.fromReader);

  return lines
    .map(l =>
      l
        .pointsOnLine()
        .map(p => `${p[0]} ${p[1]}`)
        .join(" "),
    )
    .join("\n");
}

assert(
  level3,
  `1
10 10 12 13`,
  `10 10 11 11 11 12 12 13`,
);

processFiles(level3, 3, 3);

function sortedCenters(rects: Array<Rect>): Array<Point> {
  const centers = rects.map(r => r.center());

  centers.sort((a, b) => {
    if (a[0] === b[0]) {
      return a[1] - b[1];
    }
    return a[0] - b[0];
  });

  return centers;
}

function level4(r: Reader) {
  const image = Image.fromReader(r);

  const rects = image.findRects();
  const filtered = rects.filter(r => {
    const dim = r.dim();
    return dim[0] >= 4 && dim[1] >= 4;
  });

  const centers = sortedCenters(filtered);

  return centers.map((p, i) => `${i} ${p[0]} ${p[1]}`).join(" ");
}

assert(
  level4,
  readCase(4, 0),
  `0 12 32 1 22 52 2 32 22 3 32 42 4 52 22 5 52 57 6 62 42 7 72 62 8 82 47`,
);

// level4(readCase(4, 1));

// processFiles(level4, 4, 4);

type Filter = (img: Image, val: number, p: Point) => number;

function createSquareFilter(n: number): Filter {
  return (img, val, p) => {
    for (let r = p[0]; r < p[0] + n; r++) {
      for (let c = p[1]; c < p[1] + n; c++) {
        if (img.pxAt([r, c]) !== val) {
          return 0;
        }
      }
    }
    return val;
  };
}

function level5(r: Reader) {
  const s = Number(r.nth(2));

  const image = Image.fromReader(r);

  const filter = createSquareFilter(s);

  const filtered = image.filter(filter);

  //   filtered.debug();

  const rects = filtered.findRects();

  const half = (s / 2) | 0;
  const centers: Array<Point> = [];
  for (const rect of rects) {
    const c = rect.center();
    c[0] += half;
    c[1] += half;
    if (image.pxAt(c) === rect.val) {
      //   console.log({ c, val: rect.val });
      centers.push(c);
    }
  }

  centers.sort((a, b) => {
    if (a[0] === b[0]) {
      return a[1] - b[1];
    }
    return a[0] - b[0];
  });

  //   console.log({ rects, centers });

  return centers.map((p, i) => `${i} ${p[0]} ${p[1]}`).join(" ");
}

assert(level5, readCase(5, 0), `0 1 7 1 4 4 2 6 10 3 10 4`);

// level5(readCase(5, 1));

processFiles(level5, 5, 4);
