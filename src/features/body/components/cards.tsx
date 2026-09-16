import { SiHackthebox } from "react-icons/si";
import { SlClock } from "react-icons/sl";
import { LuArrowUp } from "react-icons/lu";


export default function Cards() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-md mb-4 mx-4 md:mx-10">
                <div>
                    <div className="flex items-center justify-center w-13 h-13 bg-[#8ed6d6] rounded-full shadow-md">
                        <SiHackthebox
                        color="#079C9C"
                        size={25}
                        />
                    </div>
                </div>
                <div>
                    <div>
                        <p className="text-lg text-gray-800">Total de Produtos</p>
                    </div>
            
                    <div>
                        <p className="text-2xl font-bold text-gray-800">100</p>
                    </div>
            
                 </div>
            
            </div>


            <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-md mb-4 mx-4 md:mx-10">
            <div>
                <div className="flex items-center justify-center w-13 h-13 bg-[#FEF4DB] rounded-full shadow-md">
                    <SlClock
                    color="#E3A534"
                    size={25}
                    />
                    
                </div>
            </div>
            <div>
                <div>
                    <p className="text-lg text-gray-800">Pentente</p>
                </div>
                 
                <div>
                    <p className="text-2xl font-bold text-gray-800">100</p>
                </div>
                 
             </div>
                
        </div>


        <div className="flex items-center gap-4 bg-white p-4 rounded-lg shadow-md mb-4 mx-4 md:mx-10">
            <div>
                <div className="flex items-center justify-center w-13 h-13 bg-[#f8c1c1] rounded-full shadow-md">
                    <LuArrowUp 
                    color="#c70000"
                    size={25}
                    />
                </div>
            </div>
            <div>
                <div>
                    <p className="text-lg text-gray-800">Alta Prioridade</p>
                </div>
                 
                <div>
                    <p className="text-2xl font-bold text-gray-800">100</p>
                </div>
                 
             </div>
                
        </div>
        </div>
    )
}