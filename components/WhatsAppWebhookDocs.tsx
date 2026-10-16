'use client';

import React, { useState, useEffect } from 'react';
import { 
  MessageCircle, 
  Copy, 
  Check, 
  Sparkles, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Key, 
  Terminal, 
  RefreshCw, 
  ShieldCheck, 
  Info, 
  ChevronRight, 
  BookOpen, 
  Globe, 
  Send,
  Save,
  CheckCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabase';

interface WhatsAppWebhookDocsProps {
  isDarkMode: boolean;
}

export default function WhatsAppWebhookDocs({ isDarkMode }: WhatsAppWebhookDocsProps) {
  const [activeTab, setActiveTab] = useState<'guide' | 'tester' | 'curl'>('guide');
  const [verifyToken, setVerifyToken] = useState('agente_x_whatsapp_verify_token_2026');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isSavingToken, setIsSavingToken] = useState(false);
  const [tokenSaveSuccess, setTokenSaveSuccess] = useState(false);

  // Handshake tester state
  const [challengeString, setChallengeString] = useState('hub_challenge_test_987654');
  const [isTestingHandshake, setIsTestingHandshake] = useState(false);
  const [handshakeResult, setHandshakeResult] = useState<{
    status: number;
    success: boolean;
    body: string;
    durationMs: number;
    timestamp: string;
  } | null>(null);

  // Load existing token from Supabase system_settings if exists
  useEffect(() => {
    async function loadToken() {
      try {
        const { data } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'WHATSAPP_VERIFY_TOKEN')
          .maybeSingle();

        if (data?.value) {
          if (typeof data.value === 'string') {
            setVerifyToken(data.value);
          } else if (typeof data.value === 'object' && data.value.token) {
            setVerifyToken(data.value.token);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar token salvo:', err);
      }
    }
    loadToken();
  }, []);

  const getCallbackUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/whatsapp/webhook`;
    }
    return 'https://seu-dominio.com/api/whatsapp/webhook';
  };

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const generateSecureToken = () => {
    const array = new Uint8Array(16);
    if (typeof window !== 'undefined' && window.crypto) {
      window.crypto.getRandomValues(array);
      const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
      setVerifyToken(`wa_verify_${hex}`);
    } else {
      setVerifyToken(`wa_verify_${Math.random().toString(36).substring(2, 15)}_${Date.now()}`);
    }
  };

  const handleSaveToken = async () => {
    if (!verifyToken.trim()) return;
    setIsSavingToken(true);
    setTokenSaveSuccess(false);
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'WHATSAPP_VERIFY_TOKEN',
          value: verifyToken.trim(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;
      setTokenSaveSuccess(true);
      setTimeout(() => setTokenSaveSuccess(false), 3000);
    } catch (err: any) {
      console.error('Erro ao salvar token de verificação:', err);
      alert('Erro ao salvar no banco de dados: ' + (err.message || 'Verifique sua conexão.'));
    } finally {
      setIsSavingToken(false);
    }
  };

  const runHandshakeTest = async () => {
    setIsTestingHandshake(true);
    setHandshakeResult(null);
    const start = performance.now();
    try {
      const callback = getCallbackUrl();
      const testUrl = `${callback}?hub.mode=subscribe&hub.challenge=${encodeURIComponent(challengeString)}&hub.verify_token=${encodeURIComponent(verifyToken)}`;
      
      const res = await fetch(testUrl);
      const text = await res.text();
      const durationMs = Math.round(performance.now() - start);

      setHandshakeResult({
        status: res.status,
        success: res.status === 200 && text.trim() === challengeString.trim(),
        body: text,
        durationMs,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });
    } catch (err: any) {
      const durationMs = Math.round(performance.now() - start);
      setHandshakeResult({
        status: 0,
        success: false,
        body: err.message || 'Falha de rede ao conectar ao endpoint local.',
        durationMs,
        timestamp: new Date().toLocaleTimeString('pt-BR')
      });
    } finally {
      setIsTestingHandshake(false);
    }
  };

  return (
    <div className={`rounded-3xl border overflow-hidden ${
      isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100 shadow-sm'
    }`}>
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="size-11 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <MessageCircle size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-base md:text-lg">WhatsApp Business Cloud API — Documentação do Webhook</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Meta Official Handshake
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Guia completo, gerador de Verify Token seguro e simulador de validação de endpoint para a Meta
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="https://developers.facebook.com/apps"
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 ${
              isDarkMode 
                ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200' 
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
            }`}
          >
            <span>Painel Meta for Developers</span>
            <ExternalLink size={13} />
          </a>
        </div>
      </div>

      {/* Internal Navigation Subtabs */}
      <div className={`px-6 pt-4 border-b flex items-center gap-2 ${
        isDarkMode ? 'bg-slate-950/40 border-slate-800' : 'bg-slate-50/60 border-slate-100'
      }`}>
        {[
          { id: 'guide', label: '1. Passo a Passo (Meta)', icon: BookOpen },
          { id: 'tester', label: '2. Gerador & Simulador de Handshake', icon: ShieldCheck },
          { id: 'curl', label: '3. Testes cURL & Payload JSON', icon: Terminal },
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all -mb-px ${
              activeTab === t.id
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <t.icon size={15} />
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="p-6 space-y-6">
        {/* Tab 1: Step by Step Guide */}
        {activeTab === 'guide' && (
          <div className="space-y-6">
            {/* Quick summary card */}
            <div className={`p-4 rounded-2xl border flex items-start gap-3.5 ${
              isDarkMode ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' : 'bg-emerald-50 border-emerald-200/80 text-emerald-900'
            }`}>
              <Info size={20} className="text-emerald-500 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1">
                <p className="font-bold">Como funciona a validação de Webhook pelo Meta:</p>
                <p className="leading-relaxed opacity-90">
                  Ao salvar a URL de webhook no Meta for Developers, o servidor da Meta faz uma requisição <strong>GET</strong> para o seu endpoint com os parâmetros <code className="font-mono bg-emerald-500/20 px-1 py-0.5 rounded">hub.mode=subscribe</code>, <code className="font-mono bg-emerald-500/20 px-1 py-0.5 rounded">hub.verify_token</code> e <code className="font-mono bg-emerald-500/20 px-1 py-0.5 rounded">hub.challenge</code>. Nosso backend responde imediatamente com o mesmo <code className="font-mono">hub.challenge</code> em texto puro e status 200, ativando a sincronização instantaneamente!
                </p>
              </div>
            </div>

            {/* Steps Checklist */}
            <div className="space-y-4">
              {/* Step 1 */}
              <div className={`p-5 rounded-2xl border transition-all ${
                isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200/80 shadow-sm'
              }`}>
                <div className="flex items-start gap-4">
                  <div className="size-8 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="font-bold text-sm">Criar ou Acessar o Aplicativo Empresarial</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Acesse o portal <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-emerald-500 font-bold hover:underline">developers.facebook.com</a> com uma conta Meta vinculada ao seu Gerenciador de Negócios. Crie um aplicativo selecionando a opção <strong>Outro</strong> &gt; <strong>Empresarial (Business)</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className={`p-5 rounded-2xl border transition-all ${
                isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200/80 shadow-sm'
              }`}>
                <div className="flex items-start gap-4">
                  <div className="size-8 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="space-y-3 flex-1">
                    <h3 className="font-bold text-sm">Adicionar e Configurar o Produto WhatsApp</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      No painel lateral esquerdo do aplicativo, clique em <strong>Adicionar Produto</strong> e selecione <strong>WhatsApp</strong>. Em seguida, acesse <strong>WhatsApp &gt; Configuração</strong>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 3 */}
              <div className={`p-5 rounded-2xl border transition-all ${
                isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200/80 shadow-sm'
              }`}>
                <div className="flex items-start gap-4">
                  <div className="size-8 rounded-xl bg-emerald-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div className="space-y-3 flex-1">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="font-bold text-sm">Preencher a Callback URL e o Verify Token</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                        Etapa Crítica do Handshake
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Na seção <strong>Webhook</strong>, clique no botão <strong>Editar</strong> e cole exatamente os seguintes valores:
                    </p>

                    {/* URL Card */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        URL de Retorno de Chamada (Callback URL)
                      </label>
                      <div className="flex gap-2">
                        <div className={`flex-1 px-3.5 py-2.5 rounded-xl border font-mono text-xs overflow-x-auto select-all ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-emerald-400' : 'bg-slate-50 border-slate-200 text-emerald-700'
                        }`}>
                          {getCallbackUrl()}
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(getCallbackUrl(), 'cb_url')}
                          className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all active:scale-95"
                        >
                          {copiedField === 'cb_url' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          <span>{copiedField === 'cb_url' ? 'Copiado!' : 'Copiar URL'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Token Card */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                        Token de Verificação (Verify Token)
                      </label>
                      <div className="flex gap-2">
                        <div className={`flex-1 px-3.5 py-2.5 rounded-xl border font-mono text-xs overflow-x-auto select-all ${
                          isDarkMode ? 'bg-slate-900 border-slate-700 text-sky-400' : 'bg-slate-50 border-slate-200 text-sky-700'
                        }`}>
                          {verifyToken}
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(verifyToken, 'vt_token')}
                          className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-1.5 shrink-0 transition-all active:scale-95"
                        >
                          {copiedField === 'vt_token' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                          <span>{copiedField === 'vt_token' ? 'Copiado!' : 'Copiar Token'}</span>
                        </button>
                      </div>
                    </div>

                    <p className="text-[11px] text-slate-400 italic">
                      Dica: você pode gerar um token aleatório na aba <strong>2. Gerador & Simulador</strong> e salvar no banco de dados.
                    </p>
                  </div>
                </div>
              </div>

              {/* Step 4 */}
              <div className={`p-5 rounded-2xl border transition-all ${
                isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-white border-slate-200/80 shadow-sm'
              }`}>
                <div className="flex items-start gap-4">
                  <div className="size-8 rounded-xl bg-blue-600 text-white font-black text-xs flex items-center justify-center shrink-0">
                    4
                  </div>
                  <div className="space-y-2 flex-1">
                    <h3 className="font-bold text-sm">Inscrever-se nos Campos de Webhook</h3>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Após o handshake ser validado e salvo com sucesso, clique em <strong>Gerenciar Campos de Webhook</strong> e ative a inscrição para:
                    </p>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        messages
                      </span>
                      <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                        message_deliveries
                      </span>
                      <span className="px-3 py-1 rounded-xl text-xs font-mono font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        messaging_postbacks
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Generator & Handshake Tester */}
        {activeTab === 'tester' && (
          <div className="space-y-6">
            {/* Token Generator Card */}
            <div className={`p-5 rounded-2xl border space-y-4 ${
              isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50/80 border-slate-200'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Key size={18} className="text-emerald-500" />
                  <h3 className="font-bold text-sm">Gerenciador de Verify Token Seguro</h3>
                </div>
                <button
                  type="button"
                  onClick={generateSecureToken}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center gap-1.5 transition-all w-fit"
                >
                  <Sparkles size={14} />
                  <span>Gerar Novo Token Aleatório</span>
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={verifyToken}
                    onChange={(e) => setVerifyToken(e.target.value)}
                    placeholder="Ex: wa_verify_token_seguro_2026"
                    className={`flex-1 h-11 px-4 rounded-xl border outline-none font-mono text-xs transition-all ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyToClipboard(verifyToken, 'gen_token')}
                      className={`px-4 h-11 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 ${
                        isDarkMode ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      {copiedField === 'gen_token' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      <span>{copiedField === 'gen_token' ? 'Copiado!' : 'Copiar'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveToken}
                      disabled={isSavingToken}
                      className="px-4 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 shadow-md shadow-emerald-600/20 disabled:opacity-50"
                    >
                      {isSavingToken ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : tokenSaveSuccess ? (
                        <CheckCheck size={14} className="text-white" />
                      ) : (
                        <Save size={14} />
                      )}
                      <span>{tokenSaveSuccess ? 'Salvo no Supabase!' : 'Salvar no Sistema'}</span>
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-slate-500">
                  Ao clicar em <strong>Salvar no Sistema</strong>, o token é registrado na tabela <code className="font-mono bg-slate-500/10 px-1 py-0.5 rounded">system_settings</code> do Supabase e aplicado instantaneamente ao endpoint do webhook.
                </p>
              </div>
            </div>

            {/* Handshake Simulator Card */}
            <div className={`p-5 rounded-2xl border space-y-4 ${
              isDarkMode ? 'bg-slate-950/60 border-slate-800' : 'bg-slate-50/80 border-slate-200'
            }`}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-sky-500" />
                  <h3 className="font-bold text-sm">Simulador de Handshake da Meta (GET)</h3>
                </div>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-500">
                  hub.mode = subscribe
                </span>
              </div>

              <p className="text-xs text-slate-500">
                Dispara uma requisição de teste simulando o servidor oficial da Meta para validar se o endpoint <code className="font-mono text-emerald-500">/api/whatsapp/webhook</code> responde com código <strong>200 OK</strong> e o exato challenge.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    String de Desafio de Teste (hub.challenge)
                  </label>
                  <input
                    type="text"
                    value={challengeString}
                    onChange={(e) => setChallengeString(e.target.value)}
                    placeholder="Ex: test_challenge_string"
                    className={`w-full h-11 px-4 rounded-xl border outline-none font-mono text-xs ${
                      isDarkMode ? 'bg-slate-900 border-slate-700 text-white' : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  />
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={runHandshakeTest}
                    disabled={isTestingHandshake}
                    className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-blue-600/20 active:scale-95 disabled:opacity-50"
                  >
                    {isTestingHandshake ? (
                      <RefreshCw size={15} className="animate-spin" />
                    ) : (
                      <Play size={15} />
                    )}
                    <span>Testar Handshake Agora</span>
                  </button>
                </div>
              </div>

              {/* Handshake Result Box */}
              {handshakeResult && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-xl border space-y-2 text-xs ${
                    handshakeResult.success
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-sm">
                      {handshakeResult.success ? (
                        <>
                          <CheckCircle2 size={18} className="text-emerald-500" />
                          <span>Handshake Aprovado com Sucesso! (200 OK)</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={18} className="text-rose-500" />
                          <span>Falha na Validação do Handshake ({handshakeResult.status || 'Erro'})</span>
                        </>
                      )}
                    </div>
                    <span className="font-mono text-[10px] opacity-75">
                      {handshakeResult.durationMs}ms • {handshakeResult.timestamp}
                    </span>
                  </div>

                  <p className="leading-relaxed text-[11px]">
                    {handshakeResult.success ? (
                      <>
                        O endpoint local validou o token <code className="font-mono bg-emerald-500/20 px-1 py-0.5 rounded">{verifyToken}</code> e devolveu exatamente o corpo de resposta esperado pelo Meta (<code className="font-mono">{handshakeResult.body}</code>). O webhook está 100% pronto para ativação!
                      </>
                    ) : (
                      <>
                        O endpoint retornou status {handshakeResult.status}. Resposta: <code className="font-mono bg-rose-500/20 px-1 py-0.5 rounded">{handshakeResult.body || 'Vazia'}</code>. Verifique se clicou em <strong>Salvar no Sistema</strong> acima ou se o token corresponde.
                      </>
                    )}
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: cURL & Payload Samples */}
        {activeTab === 'curl' && (
          <div className="space-y-6">
            {/* cURL Verification GET command */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Terminal size={14} className="text-emerald-500" />
                  1. Comando cURL para teste de Handshake (GET):
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const cmd = `curl -X GET "${getCallbackUrl()}?hub.mode=subscribe&hub.challenge=test_12345&hub.verify_token=${verifyToken}"`;
                    copyToClipboard(cmd, 'curl_get');
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                >
                  {copiedField === 'curl_get' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  <span>{copiedField === 'curl_get' ? 'Copiado!' : 'Copiar cURL'}</span>
                </button>
              </div>

              <pre className={`p-4 rounded-xl font-mono text-[11px] overflow-x-auto border ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-emerald-400' : 'bg-slate-900 border-slate-800 text-emerald-300'
              }`}>
{`curl -X GET "${getCallbackUrl()}?hub.mode=subscribe&hub.challenge=test_12345&hub.verify_token=${verifyToken}"`}
              </pre>
            </div>

            {/* cURL Incoming Message Mock POST command */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Send size={14} className="text-sky-500" />
                  2. Simulação de Mensagem Recebida do Cliente (POST):
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const payload = `curl -X POST "${getCallbackUrl()}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "5511999999999",
            "phone_number_id": "1234567890"
          },
          "contacts": [{
            "profile": { "name": "Cliente de Teste" },
            "wa_id": "5511988887777"
          }],
          "messages": [{
            "from": "5511988887777",
            "id": "wamid.HBgLMTIzNDU2Nzg5",
            "timestamp": "1710000000",
            "text": { "body": "Olá! Gostaria de saber mais sobre as garantias." },
            "type": "text"
          }]
        },
        "field": "messages"
      }]
    }]
  }'`;
                    copyToClipboard(payload, 'curl_post');
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline flex items-center gap-1"
                >
                  {copiedField === 'curl_post' ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                  <span>{copiedField === 'curl_post' ? 'Copiado!' : 'Copiar Mock POST'}</span>
                </button>
              </div>

              <pre className={`p-4 rounded-xl font-mono text-[11px] overflow-x-auto border ${
                isDarkMode ? 'bg-slate-950 border-slate-800 text-sky-400' : 'bg-slate-900 border-slate-800 text-sky-300'
              }`}>
{`curl -X POST "${getCallbackUrl()}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {
            "display_phone_number": "5511999999999",
            "phone_number_id": "1234567890"
          },
          "contacts": [{
            "profile": { "name": "Cliente de Teste" },
            "wa_id": "5511988887777"
          }],
          "messages": [{
            "from": "5511988887777",
            "id": "wamid.HBgLMTIzNDU2Nzg5",
            "timestamp": "1710000000",
            "text": { "body": "Olá! Gostaria de saber mais sobre os serviços." },
            "type": "text"
          }]
        },
        "field": "messages"
      }]
    }]
  }'`}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
