import Link from "next/link";

export default function PredictionTestPage() {
  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-6">
      <div className="max-w-2xl w-full bg-gray-800 rounded-xl p-6 border border-gray-700">
        <h1 className="text-2xl font-black mb-3">Prediction Teste (Real)</h1>
        <p className="text-gray-300 mb-4">
          Esta rota agora usa exatamente a mesma pagina real de partida com dados da API FACEIT.
          Para testar, acesse com um match id em:
        </p>
        <p className="font-mono text-cyan-300 mb-6">/copadraft/prediction/teste/[id]</p>
        <div className="flex gap-3">
          <Link href="/copadraft/prediction" className="bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-bold">
            Voltar
          </Link>
          <Link href="/copadraft/prediction/teste/1-1" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-bold">
            Abrir Exemplo
          </Link>
        </div>
      </div>
    </div>
  );
}
