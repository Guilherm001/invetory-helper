'use client'

import type { Cliente } from '../services/clientesService'
import { IND_IE, formatarCep, formatarDocumento, formatarTelefone, pendenciasFiscais } from '../lib/documentos'
import { dataCurta } from '../lib/formatar'

function Item({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
  if (!valor) return null
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{rotulo}</dt>
      <dd className="mt-0.5 text-sm text-slate-800">{valor}</dd>
    </div>
  )
}

export default function TabDados({ cliente: c }: { cliente: Cliente }) {
  const pj = c.tipo === 'juridica'
  const ie = IND_IE.find((o) => o.valor === String(c.ind_ie))?.titulo
  const endereco = [
    [c.logradouro, c.numero].filter(Boolean).join(', '),
    c.complemento,
    c.bairro,
    [c.municipio, c.uf].filter(Boolean).join(' / '),
    c.cep ? formatarCep(c.cep) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const falta = pendenciasFiscais(c)

  return (
    <div className="space-y-4">
      <dl className="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
        <Item rotulo={pj ? 'Razão social' : 'Nome completo'} valor={c.nome} />
        <Item rotulo="Nome fantasia" valor={c.nome_fantasia} />
        <Item rotulo={pj ? 'CNPJ' : 'CPF'} valor={formatarDocumento(c.tipo, c.documento)} />
        <Item rotulo="RG" valor={c.rg} />
        <Item rotulo="Nascimento" valor={c.data_nascimento ? dataCurta(c.data_nascimento) : null} />
        <Item rotulo="Pessoa de contato" valor={c.contato} />
        <Item rotulo="Inscrição estadual" valor={ie} />
        <Item rotulo="Número da IE" valor={c.ie} />
        <Item rotulo="Inscrição municipal" valor={c.im} />
        <Item rotulo="Consumidor final" valor={c.consumidor_final ? 'Sim' : 'Não'} />
        <Item rotulo="Telefone" valor={c.telefone ? formatarTelefone(c.telefone) : null} />
        <Item rotulo="E-mail" valor={c.email} />
      </dl>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Endereço principal (do cadastro)
        </p>
        <p className="mt-1 text-sm text-slate-800">{endereco || 'Não informado'}</p>
        {falta.length > 0 && (
          <p className="mt-2 text-xs text-amber-700">Falta para nota fiscal: {falta.join(', ')}.</p>
        )}
      </div>

      {c.observacao && (
        <p className="whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          <strong>Observações:</strong> {c.observacao}
        </p>
      )}
    </div>
  )
}