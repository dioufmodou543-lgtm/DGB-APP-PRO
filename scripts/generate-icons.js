import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c >>> 0;
  }

  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);

  return Buffer.concat([len, typeAndData, crc]);
}

function generatePng(width, height, isMaskable = false) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // 8 bits per channel
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Generate pixels (Scanlines: filter 0 + width * 4 bytes RGBA)
  const rowLength = 1 + width * 4;
  const rawData = Buffer.alloc(height * rowLength);

  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = width * (isMaskable ? 0.44 : 0.48);
  const ringRadius = width * (isMaskable ? 0.40 : 0.44);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Default: clean white/transparent or maskable blue base
      let r = 255;
      let g = 255;
      let b = 255;
      let a = 255;

      if (isMaskable) {
        // Subtle royal blue gradient background for maskable icons
        r = 248;
        g = 250;
        b = 252;
      }

      // Outer ring of the DGB emblem
      if (Math.abs(dist - ringRadius) < width * 0.015) {
        // Royal Blue ring (#0A387E)
        r = 10;
        g = 56;
        b = 126;
        a = 255;
      } else if (dist < ringRadius) {
        // Inside emblem
        // Globe & Letters area
        const nx = dx / ringRadius;
        const ny = dy / ringRadius;

        // Central globe
        const globeDist = Math.sqrt(dx * dx + (dy + ringRadius * 0.05) * (dy + ringRadius * 0.05));
        if (globeDist < ringRadius * 0.28) {
          // Inside globe: cyan/blue gradient
          r = 14;
          g = 90;
          b = 200;
          if (Math.abs(dx) < ringRadius * 0.12 && Math.abs(dy) < ringRadius * 0.12) {
            // Continents highlight
            r = 56;
            g = 189;
            b = 248;
          }
        } else if (Math.abs(ny - 0.0) < 0.28 && Math.abs(nx) < 0.72) {
          // Letters D, G, B zone
          const isLetterStem = 
            (Math.abs(nx + 0.45) < 0.08) || // D stem
            (Math.abs(nx - 0.45) < 0.08) || // B stem
            (Math.abs(ny) < 0.06 && nx > -0.1 && nx < 0.45) || // Crossbar G-B
            (Math.abs(nx + 0.3) < 0.2 && Math.abs(ny) < 0.25 && dist > ringRadius * 0.25); // D bowl

          if (isLetterStem) {
            r = 2;
            g = 27;
            b = 121; // Deep royal blue
          }
        } else if (ny > 0.42 && ny < 0.52 && Math.abs(nx) < 0.6) {
          // '18 safar' line zone
          r = 10;
          g = 56;
          b = 126;
        }
      } else if (!isMaskable && dist > outerRadius) {
        a = 0; // Transparent outside circle for standard icons
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const deflated = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', deflated);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve('public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// 192x192
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), generatePng(192, 192, false));
// 512x512
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), generatePng(512, 512, false));
// Maskable 512x512
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), generatePng(512, 512, true));
// Apple touch icon 180x180
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), generatePng(180, 180, false));
// Also write logo.png
fs.writeFileSync(path.join(publicDir, 'logo.png'), generatePng(512, 512, false));

console.log('DGB App PRO icons successfully generated in /public!');
