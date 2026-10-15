// Máscaras e validações do cadastro de fornecedores.

const SO_DIGITOS = /\D/g

export const soDigitos = (s: string) => s.replace(SO_DIGITOS, '')

// preenche o padrão com os caracteres disponíveis, sem deixar símbolo sobrando no fim
function aplicarMascara(valor: string, padrao: string) {
  let saida = ''
  let i = 0
  for (const ch of padrao) {
    if (i >= valor.length) break
    if (ch === '#') saida += valor[i++]
    else saida += ch
  }
  return saida
}

// ---------- CPF (11 dígitos) e CNPJ (14 caracteres; a partir de jul/2026 pode ter letras) ----------

export const limparDocumento = (s: string) =>
  s.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 14)

export function formatarDocumento(bruto: string) {
  const v = limparDocumento(bruto)
  const cpf = v.length <= 11 && /^\d*$/.test(v)
  return aplicarMascara(v, cpf ? '###.###.###-##' : '##.###.###/####-##')
}

export const tipoDocumento = (v: string): 'CPF' | 'CNPJ' =>
  v.length <= 11 && /^\d*$/.test(v) ? 'CPF' : 'CNPJ'

function cpfValido(c: string) {
  if (!/^\d{11}$/.test(c) || /^(\d)\1{10}$/.test(c)) return false
  const dv = (base: string) => {
    let soma = 0
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i)
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }
  const d1 = dv(c.slice(0, 9))
  const d2 = dv(c.slice(0, 9) + d1)
  return c.slice(9) === `${d1}${d2}`
}

// cada caractere vale o código ASCII menos 48 (dígitos de 0 a 9, letras de 17 a 42)
function cnpjValido(c: string) {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(c) || /^(.)\1{13}$/.test(c)) return false
  const dv = (base: string) => {
    const pesos =
      base.length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = [...base].reduce((s, ch, i) => s + (ch.charCodeAt(0) - 48) * pesos[i], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  const d1 = dv(c.slice(0, 12))
  const d2 = dv(c.slice(0, 12) + d1)
  return c.slice(12) === `${d1}${d2}`
}

export function documentoValido(v: string) {
  if (v.length === 11) return cpfValido(v)
  if (v.length === 14) return cnpjValido(v)
  return false
}

// ---------- telefone e e-mail ----------

export function formatarTelefone(bruto: string) {
  const d = soDigitos(bruto).slice(0, 11)
  if (/^0[38]00/.test(d)) return aplicarMascara(d, '#### ### ####') // 0800 / 0300
  return aplicarMascara(d, d.length > 10 ? '(##) #####-####' : '(##) ####-####')
}

export const telefoneValido = (digitos: string) => digitos.length >= 8 && digitos.length <= 11

// só dá para chamar no WhatsApp com o DDD (10 ou 11 dígitos)
export const linkWhatsApp = (digitos: string) =>
  digitos.length >= 10 && !/^0[38]00/.test(digitos) ? `https://wa.me/55${digitos}` : null

export const linkTelefone = (digitos: string) => `tel:${digitos}`

export const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)