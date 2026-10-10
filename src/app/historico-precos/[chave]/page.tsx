import HistoricoItem from '@/features/historico-precos/components/HistoricoItem'

export default async function Page({
  params,
}: {
  params: Promise<{ chave: string }>
}) {
  const { chave } = await params
  return <HistoricoItem chave={chave} />
}