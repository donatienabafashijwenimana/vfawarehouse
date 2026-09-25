const encoder = new TextEncoder();
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let value = n;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[n] = value >>> 0;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

/** Creates a standards-compliant, uncompressed ZIP containing the uploaded file. */
export async function zipFile(file, entryName = file.name) {
  const name = encoder.encode(entryName.replace(/[\\/]/g, '_'));
  const content = new Uint8Array(await file.arrayBuffer());
  const checksum = crc32(content);
  const stamp = dosDateTime(new Date());
  const local = new Uint8Array(30 + name.length);
  const localView = new DataView(local.buffer);
  localView.setUint32(0, 0x04034b50, true);
  localView.setUint16(4, 20, true);
  localView.setUint16(6, 0x0800, true);
  localView.setUint16(8, 0, true);
  localView.setUint16(10, stamp.time, true);
  localView.setUint16(12, stamp.date, true);
  localView.setUint32(14, checksum, true);
  localView.setUint32(18, content.length, true);
  localView.setUint32(22, content.length, true);
  localView.setUint16(26, name.length, true);
  local.set(name, 30);

  const central = new Uint8Array(46 + name.length);
  const centralView = new DataView(central.buffer);
  centralView.setUint32(0, 0x02014b50, true);
  centralView.setUint16(4, 20, true);
  centralView.setUint16(6, 20, true);
  centralView.setUint16(8, 0x0800, true);
  centralView.setUint16(10, 0, true);
  centralView.setUint16(12, stamp.time, true);
  centralView.setUint16(14, stamp.date, true);
  centralView.setUint32(16, checksum, true);
  centralView.setUint32(20, content.length, true);
  centralView.setUint32(24, content.length, true);
  centralView.setUint16(28, name.length, true);
  centralView.setUint32(42, 0, true);
  central.set(name, 46);

  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, 1, true);
  endView.setUint16(10, 1, true);
  endView.setUint32(12, central.length, true);
  endView.setUint32(16, local.length + content.length, true);
  return new Blob([local, content, central, end], { type: 'application/zip' });
}
