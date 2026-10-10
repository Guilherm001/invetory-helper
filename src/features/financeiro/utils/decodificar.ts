// O relatório de caixa vem em CP850 (DOS), que o navegador não decodifica sozinho.
const CP850_ALTO =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´\u00ad±‗¾¶§÷¸°¨·¹³²■\u00a0'

export function decodificarCp850(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let texto = ''
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i]
    texto += b < 128 ? String.fromCharCode(b) : CP850_ALTO[b - 128]
  }
  return texto
}

export function decodificarWindows1252(buffer: ArrayBuffer): string {
  return new TextDecoder('windows-1252').decode(buffer)
}

// "1.956,56" -> 1956.56  |  "0.07" -> 0.07
export function lerNumero(texto: string): number {
  const t = texto.trim()
  if (t === '') return 0
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  const n = Number(normal)
  return Number.isFinite(n) ? n : NaN
}

export const arredondar = (n: number) => Math.round(n * 100) / 100