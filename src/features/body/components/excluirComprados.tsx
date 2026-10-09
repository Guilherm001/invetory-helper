'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '../../../../components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../../../../components/ui/alert-dialog'

interface ExcluirCompradosProps {
  count: number
  onConfirm: () => Promise<void>
}

export default function ExcluirComprados({ count, onConfirm }: ExcluirCompradosProps) {
  const [loading, setLoading] = useState(false)

  if (count === 0) return null

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await onConfirm()
    } catch {
      alert('Erro ao excluir os produtos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={loading} className="text-red-700 border-red-300 hover:bg-red-50">
          <Trash2 className="w-4 h-4" />
          Excluir comprados ({count})
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir produtos comprados?</AlertDialogTitle>
          <AlertDialogDescription>
            {count === 1
              ? 'Será excluído 1 produto marcado como comprado.'
              : `Serão excluídos ${count} produtos marcados como comprados.`}{' '}
            Essa ação não poderá ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className="bg-red-600 text-white hover:bg-red-700"
          >
            Excluir {count === 1 ? 'produto' : 'produtos'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}