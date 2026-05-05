import Notas from "./notas/notas";

export default function NoteCardMedio({ title }: { title: string; }) {
    return (
        <div className="bg-yellow-100 rounded-lg shadow-md p-4 w-1/3">
            {title}
            <div >
                <Notas />
            </div>

        </div>
    )
}