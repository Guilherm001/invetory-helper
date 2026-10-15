// ---------- limpeza e máscaras ----------

export const soDigitos = (s: string) => s.replace(/\D/g, '')
export const soAlfanum = (s: string) => s.toUpperCase().replace(/[^0-9A-Z]/g, '')

// "#" é onde entra um caractere; a pontuação só aparece quando há algo depois dela
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

export const formatarCpf = (v: string) => aplicarMascara(v, '###.###.###-##')
export const formatarCnpj = (v: string) => aplicarMascara(v, '##.###.###/####-##')
export const formatarCep = (v: string) => aplicarMascara(v, '#####-###')

export function formatarTelefone(v: string) {
  const d = soDigitos(v).slice(0, 11)
  return aplicarMascara(d, d.length > 10 ? '(##) #####-####' : '(##) ####-####')
}

export const formatarDocumento = (tipo: 'fisica' | 'juridica', doc: string) =>
  tipo === 'fisica' ? formatarCpf(doc) : formatarCnpj(doc)

// o que vale digitar em cada campo
export const limparCpf = (v: string) => soDigitos(v).slice(0, 11)

// CNPJ: letras e números nas 12 primeiras posições, só números nos 2 dígitos finais
export function limparCnpj(v: string) {
  const a = soAlfanum(v).slice(0, 14)
  return a.slice(0, 12) + soDigitos(a.slice(12))
}

// ---------- validação ----------

export function cpfValido(cpf: string) {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false

  const digito = (base: string) => {
    let soma = 0
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (base.length + 1 - i)
    }
    const resto = (soma * 10) % 11
    return resto === 10 ? 0 : resto
  }

  return (
    digito(cpf.slice(0, 9)) === Number(cpf[9]) &&
    digito(cpf.slice(0, 10)) === Number(cpf[10])
  )
}

// aceita o CNPJ numérico e o alfanumérico (valor do caractere = código ASCII - 48)
export function cnpjValido(cnpj: string) {
  if (!/^[0-9A-Z]{12}\d{2}$/.test(cnpj) || /^(.)\1{13}$/.test(cnpj)) return false

  const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]

  const digito = (base: string, pesos: number[]) => {
    let soma = 0
    for (let i = 0; i < base.length; i++) {
      soma += (base.charCodeAt(i) - 48) * pesos[i]
    }
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }

  return (
    digito(cnpj.slice(0, 12), pesos1) === Number(cnpj[12]) &&
    digito(cnpj.slice(0, 13), pesos2) === Number(cnpj[13])
  )
}

// ---------- listas ----------

export const UFS: string[] = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

// indicador de IE do destinatário na NF-e
export const IND_IE = [
  { valor: '1', titulo: 'Contribuinte do ICMS', desc: 'Tem inscrição estadual ativa' },
  { valor: '2', titulo: 'Contribuinte isento', desc: 'Isento de inscrição estadual' },
  { valor: '9', titulo: 'Não contribuinte', desc: 'Não tem inscrição estadual' },
] as const

// ---------- o que ainda falta para emitir nota ----------

interface Endereco {
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  bairro?: string | null
  municipio?: string | null
  uf?: string | null
  cod_municipio?: string | null
}

export function pendenciasFiscais(c: Endereco): string[] {
  const falta: string[] = []
  if (!c.cep) falta.push('CEP')
  if (!c.logradouro) falta.push('rua')
  if (!c.numero) falta.push('número')
  if (!c.bairro) falta.push('bairro')
  if (!c.municipio) falta.push('município')
  if (!c.uf) falta.push('UF')
  if (!c.cod_municipio) falta.push('código IBGE do município')

  // nada preenchido: um aviso só
  return falta.length === 7 ? ['endereço completo'] : falta
}