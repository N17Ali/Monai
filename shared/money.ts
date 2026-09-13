// Money is stored as integer Rial; the UI displays Toman. One Toman is ten
// Rial. These two functions are the only conversion between the two units, so
// the "integer Rial" invariant lives in one module instead of at every call
// site.
const RIAL_PER_TOMAN = 10;

export function tomanToRial(toman: number) {
  return Math.round(toman * RIAL_PER_TOMAN);
}

export function rialToToman(rial: number) {
  return rial / RIAL_PER_TOMAN;
}
