"use client"


import {useState, SubmitEvent} from "react"

interface SelectOption {
    label: string;
    value: number;
}

interface CardProps {
    titulo: string;

    label_comprimento: string;
    label_largura: string;
    label_largura_2?: string;
    label_button: string;

    placeholder_comprimento?: string;
    placeholder_largura?: string;
    placeholder_largura_2?: string;

    calcularFuncao: (valor1: number, valor2: number, valorSelect?: number) => number;
    calcularFuncao2?: (valor1:number, valor2: number, numeroSelect?:number) => number;
    calcularFuncao3?: (valor1:number, valor2: number) => number;

    result_resposta1: string;
    result_resposta2?: string;
    result_resposta3?: string;

    descricao_resultado1?: string;
    descricao_resultado2?: string;
    descricao_resultado3?: string;

    icone1?: React.ReactNode;
    icone2?: React.ReactNode;
    icone3?: React.ReactNode;

    selectLabel?: string;
    selectOptions?: SelectOption[];
    

}

export default function CardCalculator({
  titulo,
  label_comprimento,
  label_largura,
  label_largura_2,
  label_button,
  placeholder_comprimento,
  placeholder_largura,
  placeholder_largura_2,

  selectLabel,
  selectOptions,

  calcularFuncao,
  calcularFuncao2,
  calcularFuncao3,

  result_resposta1,
  result_resposta2,
  result_resposta3,

  descricao_resultado1,
  descricao_resultado2,
  descricao_resultado3,

  icone1,
  icone2,
  icone3
}: CardProps) {

    const [valorSelect, setValorSelect] = useState("");
    const [valor1, setValor1] = useState("");
    const [valor2, setValor2] = useState("");

    const [resultados, setResultados] = useState<(string | null)[]>([
        null,
        null,
        null,
    ])

const handleSubmit = (e: SubmitEvent<HTMLFormElement>) => {
  e.preventDefault();

  const numero1 = Number(valor1.replace(",","."));
  const numero2 = Number(valor2.replace(",","."));
  const numeroSelect = Number(valorSelect);

  if (valor1 === '' || valor2 === '') {
    return;
  }

  try {
    const resultado1 = calcularFuncao(numero1, numero2).toFixed(2);

    const resultado2 = calcularFuncao2
  ? calcularFuncao2(numero1, numero2, numeroSelect).toFixed(0)
  : null;

    const resultado3 = calcularFuncao3
      ? calcularFuncao3(numero2, numero1).toFixed(0)
      : null;

    setResultados([
      resultado1,
      resultado2,
      resultado3
    ]);

  } catch (error) {
    if (error instanceof Error) {
      setResultados([
        `Ocorreu um erro: ${error.message}`,
        null,
        null
      ]);
    }
  }
};
    const resultadosConfig = [
        {
            label: result_resposta1,
            value1: resultados[0],
            descricao: descricao_resultado1,
            icon: icone1
        },
        {
            label: result_resposta2,
            value2: resultados[1],
            descricao: descricao_resultado2,
            icon: icone2
        },
        {
            label: result_resposta3,
            value3: resultados[2],
            descricao: descricao_resultado3,
            icon: icone3
        }
    ];



    return (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-6 ">
                <div>
                    <h1 className="font-bold text-2xl">{titulo}</h1>
                </div>
                <div className="flex gap-8 ">
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm basis-1/3">
                        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                            <label htmlFor="valor1" className="flex flex-col gap-2">
                                {label_comprimento}
                            </label>
                            <input
                                id="valor1"
                                type="text"
                                inputMode="decimal"
                                value={valor1}
                                onChange={(e) => setValor1(e.target.value)}
                                placeholder={placeholder_comprimento}
                                className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm focus:border-[#079C9C] focus:outline-none focus:ring-1 focus:ring-[#079C9C] sm:text-sm"
                            />
                            <label htmlFor="valor2" className="flex flex-col gap-2">
                                {label_largura}
                            </label>
                            <input
                                id="valor2"
                                type="text"
                                inputMode="decimal"
                                value={valor2}
                                onChange={(e) => setValor2(e.target.value)}
                                placeholder={placeholder_largura}
                                className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm focus:border-[#079C9C] focus:outline-none focus:ring-1 focus:ring-[#079C9C] sm:text-sm"
                            />

                                {selectOptions && (
                                  <>
                                    <label
                                      htmlFor="select"
                                      className="flex flex-col gap-2"
                                    >
                                      {selectLabel}
                                    </label>
                                
                                    <select
                                      id="select"
                                      value={valorSelect}
                                      onChange={(e) => setValorSelect(e.target.value)}
                                      className="rounded-md border border-slate-200 bg-white px-3 py-2 shadow-sm"
                                    >
                                      <option value="">
                                        Selecione uma opção
                                      </option>
                                
                                      {selectOptions.map((option) => (
                                        <option
                                          key={option.label}
                                          value={option.value}
                                        >
                                          {option.label}
                                        </option>
                                      ))}
                                    </select>
                                  </>
                                )}                            

                            
                        
                            <button
                            type="submit"
                            className="rounded-md bg-[#079C9C] px-3 py-2 text-white shadow-sm hover:bg-[#079C9C]/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#079C9C]"
                            >
                                {label_button}
                            </button>
                        </form>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-gray-100 pl-8 shadow-sm w-full basis-2/3">
                        {resultados.some((resultado) => resultado !== null) && (
                            <div className="mt-6 flex flex-col gap-4">
                                {resultadosConfig.map(
                                    (resultado, index) =>
                                        resultado.value1 !== null && (
                                            <div key={index} className="flex flex-col gap-2">

                                                <span className="font-bold">{resultado.label}</span>

                                                <div className="flex gap-2 ">
                                                    <span className="text-6xl font-semibold text-[#079C9C] ">{resultado.value1}  </span>

                                                    {resultado.icon && resultado.icon}
                                                    <span className="text-2xl">{resultado.value2}</span>
                                                    <span className="text-2xl">{resultado.value3}</span>
                                                    
                                                    {resultado.descricao && (
                                                        <p className="font-bold text-2xl">{resultado.descricao}</p>
                                                    )}

                                                    
                                                    
                                                    
                                                </div>
                                            </div>
                                        )
                                )}
                            </div>
                        )}
                    </div>
                    
                </div>

            </div>
            
        </div>
    )
}