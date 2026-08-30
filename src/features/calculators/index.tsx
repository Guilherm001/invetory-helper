"use client"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

import { Grid3X3, PanelTop, Blocks } from "lucide-react"
import CalculatorForros from "./calculatorForros"

// import { LajeCalculator } from "./LajeCalculator"
// import { ForroPvcCalculator } from "./ForroPvcCalculator"
// import { BlocosCalculator } from "./BlocosCalculator"

export function CalculatorTabs() {
  return (
    <div className="flex flex-col gap-10">
        <Tabs defaultValue="laje" className="w-full">
          <TabsList
            variant="line"
            className="
              grid h-auto w-full grid-cols-3
              rounded-xl border border-slate-200
              bg-white p-0 shadow-sm
            "
          >
            <TabsTrigger
              value="laje"
              className="gap-2 py-4 data-[state=active]:text-[#079C9C]"
            >
              <Grid3X3 className="size-4" />
              Laje
            </TabsTrigger>
            <TabsTrigger
              value="forro-pvc"
              className="gap-2 py-4 data-[state=active]:text-[#079C9C]"
            >
              <PanelTop className="size-4" />
              Forro PVC
            </TabsTrigger>
            <TabsTrigger
              value="blocos"
              className="gap-2 py-4 data-[state=active]:text-[#079C9C]"
            >
              <Blocks className="size-4" />
              Tijolos e blocos
            </TabsTrigger>
          </TabsList>

          <TabsContent value="laje" className="mt-6">
                <h1>teste1</h1>
          </TabsContent>

          <TabsContent value="forro-pvc" className="mt-6">
            <CalculatorForros />
           </TabsContent>

           <TabsContent value="blocos" className="mt-6">
                <h1>tetse2</h1>
            </TabsContent>
        </Tabs>
    </div>
  )
}

     

      
