'use client'

import { useState } from 'react'
import BotaoAdd from './addButton'
import Corpo from "./corpo"
import Link from 'next/link'

export function Body() {
    const [refreshKey, setRefreshKey] = useState(0)

    

    return (
        <div >
            
            <div >
                <Corpo key={refreshKey} />
            </div>

        </div>
    )
}


export function Header() {
    const [refreshKey, setRefreshKey] = useState(0)
    const handleProductAdded = () => {
        setRefreshKey(prev => prev + 1)
    }
    return (
        <div>
            <div>
                    <div>
                    </div>
                    <div className="flex justify-end">
                        <Link href="/note">Adicionar Nota</Link>
                        <BotaoAdd onProductAdded={handleProductAdded} />
                    </div>
                </div>
        </div>
    )
}