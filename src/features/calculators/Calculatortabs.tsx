"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs"
import { Blocks, Grid3X3, PanelTop } from "lucide-react"
import CalculatorForros from "./calculatorForros"
import CalculatorLaje from "./calculatorLaje"
import CalculatorTijolo from "./calculatorTijolo"

const triggerClass =
  "flex-col gap-1 py-3 text-xs data-[state=active]:text-[#079C9C] sm:flex-row sm:gap-2 sm:py-4 sm:text-sm"

export function CalculatorTabs() {
  return (
    <div className="flex flex-col gap-10">
      <Tabs defaultValue="laje" className="w-full">
        <TabsList
          variant="default"
          className="grid h-auto w-full grid-cols-3 rounded-xl border border-slate-200 bg-white p-0 shadow-sm"
        >
          <TabsTrigger value="laje" className={triggerClass}>
            <Grid3X3 className="size-5 sm:size-6" aria-hidden="true" />
            Laje
          </TabsTrigger>
          <TabsTrigger value="forro-pvc" className={triggerClass}>
            <PanelTop className="size-5 sm:size-6" aria-hidden="true" />
            Forro PVC
          </TabsTrigger>
          <TabsTrigger value="blocos" className={triggerClass}>
            <Blocks className="size-5 sm:size-6" aria-hidden="true" />
            <span className="sm:hidden">Blocos</span>
            <span className="hidden sm:inline">Tijolos e blocos</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="laje" className="mt-6">
          <CalculatorLaje />
        </TabsContent>
        <TabsContent value="forro-pvc" className="mt-6">
          <CalculatorForros />
        </TabsContent>
        <TabsContent value="blocos" className="mt-6">
          <CalculatorTijolo />
        </TabsContent>
      </Tabs>
    </div>
  )
}