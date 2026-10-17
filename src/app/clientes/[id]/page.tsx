import { redirect } from 'next/navigation'
import { donoAtual } from '@/lib/auth-dono'
import FichaCliente from '@/features/clientes/components/FichaCliente'

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  // a ficha é do dono; quem não é volta para a lista
  if (!(await donoAtual())) redirect('/clientes')
  return <FichaCliente id={id} />
}