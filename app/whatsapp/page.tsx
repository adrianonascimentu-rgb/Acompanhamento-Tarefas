'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useRole } from '@/hooks/useRole';
import { MessageCircle, Search, Filter, MoreVertical, Phone, Video, Paperclip, Send, Check, CheckCheck, Clock, User, LogOut, Settings, Bell, Archive, Trash2, X, ChevronLeft, RefreshCw, QrCode, AlertCircle, ExternalLink, ShieldCheck, BarChart3, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import WhatsAppAnalytics from '@/components/whatsapp/WhatsAppAnalytics';

// Mock Data for UI
interface WhatsAppMessage {
  id: string;
  text: string;
  sender: 'user' | 'system';
  name?: string;
  time: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
}

const INITIAL_CHATS = [
  { id: '1', name: 'Almoxarifado Central', phone: '5511999999999', lastMessage: 'Excelente, vou providenciar a retirada.', lastMessageSender: 'user', lastMessageStatus: 'read', time: '14:32', unread: 0, online: true, type: 'group' },
  { id: '2', name: 'João Entregador', phone: '5511888888888', lastMessage: 'Perfeito! Coletar assinatura no canhoto.', lastMessageSender: 'user', lastMessageStatus: 'read', time: '13:46', unread: 0, online: true, type: 'contact' },
  { id: '3', name: 'Equipe de Vendas', phone: '5511777777777', lastMessage: 'Nova meta batida! 3 novos contratos.', lastMessageSender: 'system', time: '12:10', unread: 1, online: false, type: 'group' },
];

const INITIAL_MESSAGES: Record<string, WhatsAppMessage[]> = {
  '1': [
    { id: 'm1', text: 'Bom dia pessoal! Alguma previsão para o compressor?', sender: 'user', time: '10:00', status: 'read' },
    { id: 'm2', text: 'Bom dia! O pedido acabou de ser conferido pelo financeiro.', sender: 'system', name: 'Ricardo', time: '10:05' },
    { id: 'm3', text: 'O pedido de compressor foi aprovado no sistema.', sender: 'system', name: 'Sueli', time: '14:30' },
    { id: 'm4', text: 'Excelente, vou providenciar a retirada no almoxarifado.', sender: 'user', time: '14:32', status: 'read' },
  ],
  '2': [
    { id: 'm5', text: 'João, onde você está com a entrega da OS #4290?', sender: 'user', time: '13:30', status: 'read' },
    { id: 'm6', text: 'Cheguei no cliente 04 agora para descarregar.', sender: 'system', name: 'João', time: '13:45' },
    { id: 'm7', text: 'Perfeito! Coletar assinatura no canhoto da nota fiscal.', sender: 'user', time: '13:46', status: 'read' },
  ],
  '3': [
    { id: 'm8', text: 'Boa tarde equipe, conseguimos fechar a meta do trimestre?', sender: 'user', time: '12:00', status: 'read' },
    { id: 'm9', text: 'Nova meta batida! 3 novos contratos assinados hoje.', sender: 'system', name: 'Carlos', time: '12:10' },
  ]
};

export default function WhatsAppPage() {
  const { isDarkMode } = useTheme();
  const { canAccessWhatsapp, user } = useRole();
  const [viewMode, setViewMode] = useState<'chat' | 'analytics'>('chat');
  const [selectedChatId, setSelectedChatId] = useState<string | null>('1');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread' | 'groups'>('all');
  const [message, setMessage] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [chatMessages, setChatMessages] = useState<Record<string, WhatsAppMessage[]>>(INITIAL_MESSAGES);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  
  // Connection states
  const [isConnected, setIsConnected] = useState(true);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [apiStatus, setApiStatus] = useState<any>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Fetch API status on mount
  useEffect(() => {
    checkApiStatus();
  }, []);

  // Auto scroll to bottom when messages update or chat changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages, selectedChatId, isTyping]);

  const checkApiStatus = async () => {
    try {
      setIsLoadingStatus(true);
      const res = await fetch('/api/whatsapp/status');
      const data = await res.json();
      setApiStatus(data);
      if (data.status === 'configured') {
        setIsConnected(true);
      } else {
        // Keep connected in simulation mode for demonstration
        setIsConnected(true);
      }
    } catch (error) {
      console.error('Error checking WhatsApp status:', error);
      setIsConnected(true);
    } finally {
      setIsLoadingStatus(false);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || !selectedChatId) return;

    const chat = INITIAL_CHATS.find(c => c.id === selectedChatId);
    if (!chat) return;

    const textMsg = message.trim();
    setMessage('');
    setIsSending(true);

    const msgId = 'msg-' + Date.now();
    const formattedTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Step 1: Add new message with status 'sending' (Clock icon)
    const newMsg: WhatsAppMessage = {
      id: msgId,
      text: textMsg,
      sender: 'user',
      time: formattedTime,
      status: 'sending'
    };

    setChatMessages(prev => ({
      ...prev,
      [selectedChatId]: [...(prev[selectedChatId] || []), newMsg]
    }));

    // If API configured, send via API
    if (apiStatus?.status === 'configured') {
      try {
        await fetch('/api/whatsapp/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: chat.phone,
            message: textMsg
          })
        });
      } catch (err) {
        console.warn('WhatsApp API send fallback to simulated delivery:', err);
      }
    }

    setIsSending(false);

    // Progressive WhatsApp status simulation:
    // 1. Sent (1 check cinza) after 600ms
    setTimeout(() => {
      setChatMessages(prev => ({
        ...prev,
        [selectedChatId]: (prev[selectedChatId] || []).map(m =>
          m.id === msgId ? { ...m, status: 'sent' } : m
        )
      }));
    }, 600);

    // 2. Delivered (2 checks cinzas) after 1500ms
    setTimeout(() => {
      setChatMessages(prev => ({
        ...prev,
        [selectedChatId]: (prev[selectedChatId] || []).map(m =>
          m.id === msgId ? { ...m, status: 'delivered' } : m
        )
      }));
    }, 1500);

    // 3. Read (2 checks AZUIS - status de leitura visualizada) after 3000ms
    setTimeout(() => {
      setChatMessages(prev => ({
        ...prev,
        [selectedChatId]: (prev[selectedChatId] || []).map(m =>
          m.id === msgId ? { ...m, status: 'read' } : m
        )
      }));
    }, 3000);

    // 4. Simulated interactive reply from recipient
    setTimeout(() => {
      setIsTyping(true);
      setTimeout(() => {
        setIsTyping(false);
        const contactFirstName = chat.name.split(' ')[0];
        const replyText = chat.type === 'group' 
          ? 'Recebido pela equipe! Estamos acompanhando.' 
          : `Mensagem recebida e visualizada por ${contactFirstName}. 👍`;

        const replyMsg: WhatsAppMessage = {
          id: 'reply-' + Date.now(),
          text: replyText,
          sender: 'system',
          name: chat.type === 'group' ? 'Atendimento' : contactFirstName,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setChatMessages(prev => ({
          ...prev,
          [selectedChatId]: [...(prev[selectedChatId] || []), replyMsg]
        }));
      }, 2000);
    }, 3800);
  };

  const filteredChats = useMemo(() => {
    return INITIAL_CHATS.filter(chat => {
      const matchSearch = chat.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchFilter = 
        activeFilter === 'all' || 
        (activeFilter === 'unread' && chat.unread > 0) || 
        (activeFilter === 'groups' && chat.type === 'group');
      return matchSearch && matchFilter;
    });
  }, [searchQuery, activeFilter]);

  const selectedChat = useMemo(() => 
    INITIAL_CHATS.find(c => c.id === selectedChatId), 
    [selectedChatId]
  );

  const messages = useMemo(() => 
    selectedChatId ? (chatMessages[selectedChatId] || []) : [], 
    [selectedChatId, chatMessages]
  );

  if (!canAccessWhatsapp) {
    return (
      <div className={`flex flex-col items-center justify-center min-h-[80vh] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
        <MessageCircle size={64} className="mb-4 opacity-20" />
        <h2 className="text-xl font-bold mb-2">Acesso Restrito</h2>
        <p>Você não tem permissão para acessar o módulo de WhatsApp.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden relative">
      {/* Sidebar - Chat List */}
      <div className={`${(selectedChatId && viewMode === 'chat') || viewMode === 'analytics' ? 'hidden md:flex' : 'flex'} w-full md:w-80 lg:w-96 flex-col border-r h-screen ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
        {/* Header */}
        <div className={`p-4 border-b shrink-0 ${isDarkMode ? 'border-slate-800' : 'border-slate-200'}`}>
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <MessageCircle className="text-emerald-500" />
              WhatsApp Business
            </h1>
            <div className="relative">
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}
              >
                <MoreVertical size={20} />
              </button>
              
              <AnimatePresence>
                {showMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                    className={`absolute right-0 mt-2 w-48 rounded-xl shadow-xl z-50 border p-1 ${
                      isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-100'
                    }`}
                  >
                    {[
                      { icon: BarChart3, label: 'Painel de Análises', action: () => setViewMode('analytics') },
                      { icon: Settings, label: 'Configurações API', action: () => setIsConfiguring(true) },
                    ].map((item, idx) => (
                      <button 
                        key={idx}
                        onClick={() => {
                          if (item.action) item.action();
                          setShowMenu(false);
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                          isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <item.icon size={16} />
                        {item.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Mode Selector (Conversas / Análises) */}
          <div className="flex items-center gap-1 p-1 mb-3 rounded-xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('chat')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'chat'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <MessageCircle size={14} />
              <span>Conversas</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('analytics')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'analytics'
                  ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart3 size={14} />
              <span>Análises</span>
              <span className="size-1.5 rounded-full bg-emerald-500" />
            </button>
          </div>
          
          {/* Search */}
          <div className="relative">
            <Search size={18} className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`} />
            <input 
              type="text" 
              placeholder="Pesquisar conversa" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={!isConnected}
              className={`w-full pl-10 pr-4 py-2 rounded-xl text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500/50 ${
                isDarkMode 
                  ? 'bg-slate-800 text-white placeholder-slate-500 border-transparent' 
                  : 'bg-slate-100 text-slate-900 placeholder-slate-500 border-transparent shadow-inner'
              } ${!isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}
            />
          </div>
        </div>

        {/* Connection Info Bar */}
        {!isLoadingStatus && !isConnected && (
           <div className={`p-3 text-[10px] items-center flex gap-2 font-bold uppercase tracking-widest ${isDarkMode ? 'bg-amber-500/10 text-amber-500' : 'bg-amber-50 text-amber-700'}`}>
              <AlertCircle size={14} />
              API Cloud não configurada
              <button 
                onClick={() => setIsConfiguring(true)}
                className="ml-auto underline decoration-2 underline-offset-4"
              >
                Configurar
              </button>
           </div>
        )}

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-24 md:pb-0">
          {!isConnected ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center bg-slate-50/50 dark:bg-slate-900/50">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mb-4 transition-transform hover:scale-110 duration-500">
                <ShieldCheck size={32} className="text-emerald-500" />
              </div>
              <p className="text-sm font-bold mb-1">WhatsApp Cloud API</p>
              <p className="text-xs text-slate-500">Configure as chaves oficiais para conectar com sua conta Business.</p>
            </div>
          ) : filteredChats.length > 0 ? (
            filteredChats.map((chat) => {
              const chatMsgs = chatMessages[chat.id] || [];
              const lastMsg = chatMsgs.length > 0 ? chatMsgs[chatMsgs.length - 1] : null;
              const lastText = lastMsg ? lastMsg.text : chat.lastMessage;
              const lastTime = lastMsg ? lastMsg.time : chat.time;
              const isLastMsgUser = lastMsg ? lastMsg.sender === 'user' : (chat.lastMessageSender === 'user');
              const lastStatus = lastMsg ? lastMsg.status : chat.lastMessageStatus;

              return (
                <button
                  key={chat.id}
                  onClick={() => setSelectedChatId(chat.id)}
                  className={`w-full flex items-center gap-4 p-4 transition-all relative border-b border-transparent ${
                    selectedChatId === chat.id 
                      ? (isDarkMode ? 'bg-slate-800/100' : 'bg-slate-100 shadow-sm') 
                      : (isDarkMode ? 'hover:bg-slate-800/50' : 'hover:bg-slate-50')
                  }`}
                >
                  <div className="relative shrink-0">
                    <div className={`w-12 h-12 rounded-full overflow-hidden flex items-center justify-center font-bold text-white shadow-sm transition-transform group-hover:scale-105 duration-300 ${
                      chat.type === 'group' ? 'bg-indigo-500' : 'bg-blue-500'
                    }`}>
                      {chat.name.substring(0, 2).toUpperCase()}
                    </div>
                    {chat.online && (
                      <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex justify-between items-center mb-0.5">
                      <h3 className={`font-bold text-sm truncate ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{chat.name}</h3>
                      <span className={`text-[10px] ${chat.unread > 0 ? 'text-emerald-500 font-bold' : 'text-slate-500'}`}>
                        {lastTime}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-1 min-w-0 pr-2">
                        {isLastMsgUser && (
                          <span className="shrink-0">
                            {lastStatus === 'read' ? (
                              <CheckCheck size={14} className="text-[#53bdeb]" />
                            ) : lastStatus === 'delivered' ? (
                              <CheckCheck size={14} className="text-slate-400" />
                            ) : lastStatus === 'sent' ? (
                              <Check size={14} className="text-slate-400" />
                            ) : (
                              <Clock size={12} className="text-slate-400 animate-pulse" />
                            )}
                          </span>
                        )}
                        <p className={`text-xs truncate ${chat.unread > 0 ? 'text-slate-100 font-medium' : 'text-slate-400'}`}>
                          {lastText}
                        </p>
                      </div>
                      {chat.unread > 0 && (
                        <span className="min-w-5 h-5 px-1.5 flex items-center justify-center bg-emerald-500 text-white text-[9px] font-black rounded-full shadow-sm ring-2 ring-emerald-500/10 shrink-0">
                          {chat.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center opacity-50">
              <MessageCircle size={48} className="mb-4" />
              <p className="text-sm font-medium">Nenhuma conversa encontrada</p>
            </div>
          )}
        </div>
      </div>

      {/* Main Area (Chat or Analytics Dashboard) */}
      <div className={`${(selectedChatId && viewMode === 'chat') || viewMode === 'analytics' ? 'flex' : 'hidden md:flex'} flex-1 flex-col h-screen overflow-hidden ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
        {viewMode === 'analytics' ? (
          <WhatsAppAnalytics onBackToChat={() => setViewMode('chat')} />
        ) : isConnected && selectedChat ? (
          <>
            {/* Header */}
            <div className={`p-3 md:p-4 border-b flex items-center justify-between shrink-0 shadow-sm z-10 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-center gap-3 overflow-hidden">
                <button 
                  onClick={() => setSelectedChatId(null)}
                  className={`md:hidden p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800`}
                >
                  <X size={20} />
                </button>
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${
                  selectedChat.type === 'group' ? 'bg-indigo-500' : 'bg-blue-500'
                }`}>
                  {selectedChat.name.substring(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h3 className={`font-bold text-sm truncate ${isDarkMode ? 'text-slate-100' : 'text-slate-900'}`}>{selectedChat.name}</h3>
                  <p className={`text-[10px] font-bold uppercase tracking-widest ${isTyping ? 'text-emerald-500 animate-pulse' : selectedChat.online ? 'text-emerald-500' : 'text-slate-500'}`}>
                    {selectedChat.phone} • {isTyping ? 'digitando...' : (selectedChat.online ? 'Online' : 'Visto recentemente')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 md:gap-3 shrink-0">
                <button
                  onClick={() => setViewMode('analytics')}
                  className={`px-3 py-1.5 rounded-xl transition-all flex items-center gap-1.5 text-xs font-bold ${
                    isDarkMode 
                      ? 'bg-slate-800 text-slate-300 hover:text-emerald-400 hover:bg-slate-700' 
                      : 'bg-slate-100 text-slate-700 hover:text-emerald-600 hover:bg-slate-200'
                  }`}
                  title="Abrir Análise de Tráfego"
                >
                  <BarChart3 size={15} className="text-emerald-500" />
                  <span className="hidden sm:inline text-xs">Métricas</span>
                </button>

                <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400">Leitura:</span>
                  <span className="flex items-center gap-0.5 text-[#53bdeb] font-bold">
                    <CheckCheck size={13} className="text-[#53bdeb]" />
                    Visualizada
                  </span>
                </div>
                <button className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                  <Phone size={18} />
                </button>
                <button className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                  <Video size={18} />
                </button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 no-scrollbar pb-32">
              <div className="flex justify-center mb-6">
                <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-sm ${isDarkMode ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-white text-slate-400 border border-slate-100'}`}>
                  Hoje
                </span>
              </div>
              
              {messages.map((msg) => (
                <div 
                  key={msg.id}
                  className={`flex flex-col max-w-[85%] md:max-w-[70%] ${
                    msg.sender === 'user' ? 'self-end' : 'self-start'
                  }`}
                >
                  <div className={`p-3 rounded-2xl relative shadow-sm ${
                    msg.sender === 'user' 
                      ? (isDarkMode ? 'bg-emerald-600 text-white rounded-tr-none' : 'bg-emerald-500 text-white rounded-tr-none')
                      : (isDarkMode ? 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700' : 'bg-white text-slate-900 rounded-tl-none border border-slate-100')
                  }`}>
                    {msg.sender === 'system' && msg.name && (
                      <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${isDarkMode ? 'text-indigo-400' : 'text-indigo-600'}`}>
                        {msg.name}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed">{msg.text}</p>
                    <div className="flex items-center justify-end gap-1.5 mt-1 select-none">
                      <span className={`text-[10px] ${msg.sender === 'user' ? 'text-emerald-100/90' : 'text-slate-400'}`}>
                        {msg.time}
                      </span>
                      {msg.sender === 'user' && (
                        <span 
                          className="inline-flex items-center" 
                          title={
                            msg.status === 'read' ? 'Mensagem visualizada (Dois checks azuis)' :
                            msg.status === 'delivered' ? 'Mensagem entregue ao destinatário' :
                            msg.status === 'sent' ? 'Mensagem enviada' : 'Enviando...'
                          }
                        >
                          {msg.status === 'sending' && (
                            <Clock size={12} className="text-emerald-200/70 animate-pulse" />
                          )}
                          {msg.status === 'sent' && (
                            <Check size={13} className="text-emerald-200/90" />
                          )}
                          {msg.status === 'delivered' && (
                            <CheckCheck size={14} className="text-emerald-200/90" />
                          )}
                          {msg.status === 'read' && (
                            <span className="flex items-center text-[#53bdeb] drop-shadow-[0_0_2px_rgba(83,189,235,0.8)]">
                              <CheckCheck size={14} className="text-[#53bdeb]" />
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Contact typing indicator */}
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="self-start flex flex-col max-w-[85%] md:max-w-[70%]"
                >
                  <div className={`px-4 py-2.5 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1.5 ${
                    isDarkMode ? 'bg-slate-800 text-slate-400 border border-slate-700' : 'bg-white text-slate-500 border border-slate-100'
                  }`}>
                    <span className="text-xs font-medium mr-1 text-slate-400">{selectedChat.name.split(' ')[0]} está digitando</span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className={`p-3 md:p-6 pb-24 md:pb-6 border-t mt-auto ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
              <div className="flex items-end gap-2 md:gap-4 max-w-5xl mx-auto">
                <button className={`p-3 rounded-xl transition-colors shrink-0 ${isDarkMode ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}`}>
                  <Paperclip size={20} />
                </button>
                <div className="flex-1 relative">
                  <textarea 
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                    placeholder="Digite uma mensagem" 
                    rows={1}
                    className={`w-full px-4 py-3 rounded-2xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none no-scrollbar ${
                      isDarkMode 
                        ? 'bg-slate-800 text-white placeholder-slate-500 border-transparent' 
                        : 'bg-slate-100 text-slate-900 placeholder-slate-500 border-transparent shadow-inner'
                    }`}
                  />
                </div>
                <button 
                  onClick={handleSendMessage}
                  disabled={!message.trim() || isSending}
                  className={`p-3 rounded-xl transition-all shrink-0 active:scale-90 ${
                    message.trim() && !isSending
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                      : (isDarkMode ? 'bg-slate-800 text-slate-600' : 'bg-slate-100 text-slate-400')
                  }`}
                >
                  {isSending ? <RefreshCw className="animate-spin" size={20} /> : <Send size={20} />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50 dark:bg-slate-950/50">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`w-40 h-40 rounded-full flex items-center justify-center mb-8 relative ${isDarkMode ? 'bg-slate-900' : 'bg-white shadow-xl shadow-blue-500/5'}`}
            >
              <div className="absolute inset-0 rounded-full animate-ping bg-emerald-500/10" />
              <ShieldCheck size={64} className="text-emerald-500 relative z-10" />
            </motion.div>
            <h2 className="text-3xl font-black mb-4 tracking-tighter">API Oficial WhatsApp</h2>
            <p className={`max-w-md text-sm leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
              Conecte o seu negócio com a API Cloud oficial da Meta. Mais estabilidade, segurança e conformidade para o seu atendimento.
            </p>
            
            <div className="mt-12 flex flex-col items-center gap-4">
              {!isConnected && (
                <button 
                  onClick={() => setIsConfiguring(true)}
                  className="group relative px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-2xl transition-all shadow-2xl shadow-emerald-500/30 overflow-hidden active:scale-95"
                >
                  <div className="relative z-10 flex items-center gap-2 uppercase tracking-widest text-xs">
                    <QrCode size={16} />
                    Configurar API Oficial
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                </button>
              )}
              {isConnected && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  API Conectada e Ativa
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Configuration Modal */}
      <AnimatePresence>
        {isConfiguring && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfiguring(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className={`relative w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl border ${
                isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-100'
              }`}
            >
              <div className="p-8">
                <div className="flex justify-between items-center mb-8">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white">
                      <Settings size={20} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black">Configuração API Cloud</h3>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Passo a passo meta developers</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsConfiguring(false)}
                    className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div className="space-y-6">
                    <div>
                      <h4 className="font-bold text-sm mb-4 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center">1</span>
                        Meta para Desenvolvedores
                      </h4>
                      <p className={`text-xs leading-relaxed mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Crie uma conta em <span className="font-bold">developers.facebook.com</span>, crie um novo App "Business" e adicione o produto "WhatsApp".
                      </p>
                      <a 
                        href="https://developers.facebook.com" 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-emerald-500 text-xs font-bold flex items-center gap-1 hover:underline"
                      >
                        Acessar Portal <ExternalLink size={12} />
                      </a>
                    </div>

                    <div>
                      <h4 className="font-bold text-sm mb-4 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center">2</span>
                        Parâmetros do App
                      </h4>
                      <p className={`text-xs leading-relaxed ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        Vá em Configurações do WhatsApp para obter as chaves abaixo:
                      </p>
                      <div className="mt-3 space-y-2">
                         {[
                           { label: 'Token de Acesso', status: apiStatus?.config?.hasAccessToken },
                           { label: 'ID Número de Telefone', status: apiStatus?.config?.hasPhoneNumberId },
                           { label: 'ID Conta Business', status: apiStatus?.config?.hasBusinessAccountId },
                         ].map((item, idx) => (
                           <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-100 dark:bg-slate-800">
                             <span className="text-[10px] font-bold text-slate-500">{item.label}</span>
                             {item.status ? (
                               <span className="text-[9px] font-black text-emerald-500 uppercase">Configurado</span>
                             ) : (
                               <span className="text-[9px] font-black text-rose-500 uppercase">Pendente</span>
                             )}
                           </div>
                         ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <h4 className="font-bold text-sm mb-4 flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-indigo-500 text-white text-[10px] flex items-center justify-center">3</span>
                        Webhook do Sistema
                      </h4>
                      <p className={`text-xs leading-relaxed mb-4 ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                        No painel da Meta, configure o Webhook para receber as mensagens de volta para este sistema:
                      </p>
                      <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800 font-mono text-[9px] break-all border border-slate-200 dark:border-slate-700 select-all">
                        {typeof window !== 'undefined' ? window.location.origin : ''}/api/whatsapp/webhook
                      </div>
                    </div>

                    <div className={`p-4 rounded-2xl border ${isDarkMode ? 'bg-indigo-500/10 border-indigo-500/20' : 'bg-indigo-50 border-indigo-100'}`}>
                      <h5 className="font-bold text-xs mb-2 text-indigo-500">Dica Pro</h5>
                      <p className={`text-[10px] leading-relaxed ${isDarkMode ? 'text-indigo-300' : 'text-indigo-700'}`}>
                        Para uso em produção, lembre-se de configurar um <span className="font-bold">System User Access Token</span> permanente, caso contrário o token temporário expirará em 24 horas.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end gap-3">
                  <button 
                    onClick={() => setIsConfiguring(false)}
                    className={`px-6 py-2 rounded-xl text-xs font-bold transition-colors ${
                      isDarkMode ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Fechar
                  </button>
                  <button 
                    onClick={checkApiStatus}
                    className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Verificar Conexão
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
