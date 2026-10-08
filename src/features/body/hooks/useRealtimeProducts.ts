"use client"

import { useEffect } from "react"
import { supabase } from "@/lib/supabase"
import type { Product } from "../services/listService"

type Handlers = {
  onInsert: (product: Product) => void
  onUpdate: (product: Product) => void
  onDelete: (id: string) => void
}

export function useRealtimeProducts({ onInsert, onUpdate, onDelete }: Handlers) {
  useEffect(() => {
    const channel = supabase
      .channel("products-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "products" },
        (payload) => onInsert(payload.new as Product)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "products" },
        (payload) => onUpdate(payload.new as Product)
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "products" },
        (payload) => onDelete((payload.old as Product).id as string)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}