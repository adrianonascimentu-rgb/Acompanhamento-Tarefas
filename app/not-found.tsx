import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <h1 className="text-4xl font-extrabold mb-2">404</h1>
      <p className="text-slate-500 dark:text-slate-400 mb-6">Página não encontrada.</p>
      <Link
        href="/"
        className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all"
      >
        Voltar para o Início
      </Link>
    </div>
  );
}
