// Dados que aparecem no topo do cupom, do A4 e do PDF. Preencha o que quiser mostrar.
// Campos vazios simplesmente não aparecem.
export const EMPRESA = {
  razao: 'GROWLIM',
  cnpj: '00.000.000/0000-00',
  endereco: 'VISCONDE DE INHAUMA 497',
  telefone: '(11) 9 8213-919',
  rodape: 'Obrigado pela preferência!',
}

// largura útil do cupom em mm: 72 para bobina de 80 mm (TM-T20), 48 para bobina de 58 mm
export const LARGURA_CUPOM_MM = 72

// até duas linhas de texto para o cabeçalho
export function linhasEmpresa(): string[] {
  return [
    [EMPRESA.razao, EMPRESA.cnpj ? `CNPJ ${EMPRESA.cnpj}` : ''].filter(Boolean).join(' · '),
    [EMPRESA.endereco, EMPRESA.telefone].filter(Boolean).join(' · '),
  ].filter(Boolean)
}

export const CUPOM_PELO_SERVICO = true