'use client';

import { useState } from 'react';
import { Tag, Store, DollarSign, Package, CheckCircle2, AlertCircle, Loader2, Copy, Check } from 'lucide-react';

interface PriceResearchFormProps {
  onSuccess?: () => void;
  isDarkMode?: boolean;
}

const CREATE_TABLE_SQL = `CREATE TABLE IF NOT EXISTS competitor_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  product_code TEXT,
  product_name TEXT,
  full_price NUMERIC(10, 2),
  cash_price NUMERIC(10, 2),
  store_name TEXT,
  company_id UUID,
  created_by UUID
);

ALTER TABLE competitor_prices ENABLE ROW LEVEL SECURITY;

-- Política de isolamento por empresa/colaborador
DROP POLICY IF EXISTS "competitor_prices_select_policy" ON competitor_prices;
CREATE POLICY "competitor_prices_select_policy" ON competitor_prices
FOR SELECT TO authenticated, anon
USING (
  (company_id IS NOT NULL AND company_id = public.get_user_company_id(auth.uid()))
  OR (created_by IS NOT NULL AND created_by = auth.uid())
  OR (created_by IN (SELECT id FROM public.profiles WHERE company_id = public.get_user_company_id(auth.uid())))
  OR company_id IS NULL
  OR public.is_admin_or_manager(auth.uid())
);

DROP POLICY IF EXISTS "competitor_prices_insert_policy" ON competitor_prices;
CREATE POLICY "competitor_prices_insert_policy" ON competitor_prices
FOR INSERT TO authenticated, anon WITH CHECK (true);

DROP POLICY IF EXISTS "competitor_prices_delete_policy" ON competitor_prices;
CREATE POLICY "competitor_prices_delete_policy" ON competitor_prices
FOR DELETE TO authenticated, anon
USING (
  (company_id IS NOT NULL AND company_id = public.get_user_company_id(auth.uid()))
  OR (created_by IS NOT NULL AND created_by = auth.uid())
  OR public.is_admin_or_manager(auth.uid())
  OR company_id IS NULL
);

DROP POLICY IF EXISTS "competitor_prices_update_policy" ON competitor_prices;
CREATE POLICY "competitor_prices_update_policy" ON competitor_prices
FOR UPDATE TO authenticated, anon
USING (
  (company_id IS NOT NULL AND company_id = public.get_user_company_id(auth.uid()))
  OR (created_by IS NOT NULL AND created_by = auth.uid())
  OR public.is_admin_or_manager(auth.uid())
)
WITH CHECK (
  (company_id IS NOT NULL AND company_id = public.get_user_company_id(auth.uid()))
  OR (created_by IS NOT NULL AND created_by = auth.uid())
  OR public.is_admin_or_manager(auth.uid())
);

NOTIFY pgrst, 'reload schema';`;

export default function PriceResearchForm({ onSuccess, isDarkMode }: PriceResearchFormProps) {
  const [formData, setFormData] = useState({
    product_code: '',
    product_name: '',
    full_price: '',
    cash_price: '',
    store_name: '',
  });

  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string; missing_table?: boolean } | null>(null);

  const handleCopySql = () => {
    navigator.clipboard.writeText(CREATE_TABLE_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch('/api/competitor-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao salvar pesquisa', { cause: data.missing_table });
      }

      setMessage({ type: 'success', text: 'Pesquisa gravada com sucesso!' });
      setFormData({
        product_code: '',
        product_name: '',
        full_price: '',
        cash_price: '',
        store_name: '',
      });
      if (onSuccess) {
        onSuccess();
      }
    } catch (err: any) {
      const isMissing = err?.cause || err?.message?.includes('schema cache') || err?.message?.includes('competitor_prices');
      setMessage({ 
        type: 'error', 
        text: err.message || 'Erro ao enviar os dados.',
        missing_table: Boolean(isMissing)
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`p-6 rounded-2xl shadow-sm border transition-colors ${
      isDarkMode 
        ? 'bg-slate-900 border-slate-800 text-slate-100' 
        : 'bg-white border-slate-200 text-slate-800'
    }`}>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
          <Tag className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold">Pesquisa de Preço do Concorrente</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Informe os dados observados no concorrente. Nenhum campo é obrigatório.
          </p>
        </div>
      </div>

      {message && (
        <div className="mb-5 space-y-3">
          <div
            className={`p-3.5 rounded-xl text-sm flex items-center gap-2.5 font-medium border ${
              message.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-500" />
            )}
            <span>{message.text}</span>
          </div>

          {message.missing_table && (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold">Script SQL para criar a tabela no Supabase Editor:</span>
                <button
                  type="button"
                  onClick={handleCopySql}
                  className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 transition-colors flex items-center gap-1.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado!' : 'Copiar SQL'}
                </button>
              </div>
              <pre className="p-2.5 rounded-lg bg-slate-900 text-slate-200 overflow-x-auto font-mono text-[11px] leading-relaxed">
                {CREATE_TABLE_SQL}
              </pre>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-slate-400" />
            Código do Nosso Produto
          </label>
          <input
            type="text"
            name="product_code"
            value={formData.product_code}
            onChange={handleChange}
            placeholder="Ex: PROD-123"
            className={`w-full px-3.5 py-2.5 text-sm rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDarkMode 
                ? 'bg-slate-800/80 border-slate-700 text-slate-100 placeholder-slate-500' 
                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-slate-400" />
            Nome do Produto
          </label>
          <input
            type="text"
            name="product_name"
            value={formData.product_name}
            onChange={handleChange}
            placeholder="Ex: Tênis Esportivo X"
            className={`w-full px-3.5 py-2.5 text-sm rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDarkMode 
                ? 'bg-slate-800/80 border-slate-700 text-slate-100 placeholder-slate-500' 
                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-slate-400" />
              Preço Cheio (R$)
            </label>
            <input
              type="number"
              step="0.01"
              name="full_price"
              value={formData.full_price}
              onChange={handleChange}
              placeholder="0.00"
              className={`w-full px-3.5 py-2.5 text-sm rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDarkMode 
                  ? 'bg-slate-800/80 border-slate-700 text-slate-100 placeholder-slate-500' 
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-slate-400" />
              Preço À Vista (R$)
            </label>
            <input
              type="number"
              step="0.01"
              name="cash_price"
              value={formData.cash_price}
              onChange={handleChange}
              placeholder="0.00"
              className={`w-full px-3.5 py-2.5 text-sm rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDarkMode 
                  ? 'bg-slate-800/80 border-slate-700 text-slate-100 placeholder-slate-500' 
                  : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
              }`}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1 flex items-center gap-1.5">
            <Store className="w-3.5 h-3.5 text-slate-400" />
            Nome da Loja Concorrente
          </label>
          <input
            type="text"
            name="store_name"
            value={formData.store_name}
            onChange={handleChange}
            placeholder="Ex: Loja ABC"
            className={`w-full px-3.5 py-2.5 text-sm rounded-xl border transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              isDarkMode 
                ? 'bg-slate-800/80 border-slate-700 text-slate-100 placeholder-slate-500' 
                : 'bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400'
            }`}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-bold text-sm py-3 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Salvando...
            </>
          ) : (
            'Salvar Pesquisa'
          )}
        </button>
      </form>
    </div>
  );
}
