/** Decode uint64 packed message from CreateScreen (UTF-8 bytes, MSB-first). */
export function decodeUint64Message(value: bigint): string {
  if (value === 0n) return "";
  const bytes: number[] = [];
  let v = value;
  while (v > 0n && bytes.length < 8) {
    bytes.push(Number(v & 0xffn));
    v >>= 8n;
  }
  bytes.reverse();
  return new TextDecoder().decode(new Uint8Array(bytes)).replace(/\0/g, "");
}
