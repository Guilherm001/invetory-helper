/**
 * Converte texto digitado em número.
 * Aceita "2,5", "2.5" e "1.234,5". Retorna NaN se vazio ou inválido.
 */
export const parseNumero = (texto: string): number => {
  const t = texto.trim()
  if (t === "") return NaN
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t)
}

/**
 * Arredonda para cima, ignorando ruído de ponto flutuante.
 * Sem isso, 4.3 / 0.43 = 10.000000000000002 viraria 11.
 */
export const cima = (n: number): number => Math.ceil(Math.round(n * 1e6) / 1e6)

/** Arredonda para baixo, ignorando ruído de ponto flutuante. */
export const baixo = (n: number): number => Math.floor(Math.round(n * 1e6) / 1e6)

/** Formata no padrão brasileiro (1.234,50). `fixo` força sempre `casas` decimais. */
export const formatar = (n: number, casas = 2, fixo = false): string =>
  n.toLocaleString("pt-BR", {
    minimumFractionDigits: fixo ? casas : 0,
    maximumFractionDigits: casas,
  })