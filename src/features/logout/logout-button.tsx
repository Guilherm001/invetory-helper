"use client"

import { useState } from "react"
import { LogOut } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"

export function LogoutButton() {
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    await supabase.auth.signOut()
    // reload completo: limpa estado em memória e força o middleware a reavaliar
    window.location.assign("/")
  }

  return (
    <Button variant="outline" onClick={handleLogout} disabled={loading}>
      <LogOut className="w-4 h-4" />
      {loading ? "Saindo..." : "Sair"}
    </Button>
  )
}