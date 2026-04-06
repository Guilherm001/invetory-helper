'use client'

import { useState } from 'react'
import BotaoAdd from './addButton'
import Corpo from "./corpo"

export default function Body() {
    const [refreshKey, setRefreshKey] = useState(0)

    const handleProductAdded = () => {
        setRefreshKey(prev => prev + 1)
    }

    return (
        <div className="flex flex-col max-w-300 min-w-100 m-auto h-screen bg-white">

            {/* Header fixo com botão */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 py-4 px-4 md:py-0 md:border-b-0 md:px-10 md:m-10">
                <div className="flex justify-end">
                    <BotaoAdd onProductAdded={handleProductAdded} />
                </div>
            </div>

            {/* Conteúdo scrollável */}
            <div className="flex-1 overflow-y-auto px-4 md:px-10">
                <Corpo key={refreshKey} />
            </div>

        </div>
    )
}