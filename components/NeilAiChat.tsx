'use client';

import { useState, useRef, useEffect } from 'react';
import { Bot, X, Maximize2, Minimize2, Mic, MicOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAppContext } from '@/context/AppContext';
import 'regenerator-runtime/runtime';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';

export default function NeilAiChat() {
  const { context, user, userData, isAuthReady } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [localInput, setLocalInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Speech Recognition Hook
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } = useSpeechRecognition();
  
  // Update local input when transcript changes
  useEffect(() => {
    if (listening && transcript) {
      setLocalInput(transcript);
    }
  }, [transcript, listening]);

  const toggleListening = () => {
    if (listening) {
      SpeechRecognition.stopListening();
    } else {
      resetTranscript();
      SpeechRecognition.startListening({ continuous: true, language: 'pt-BR' });
    }
  };

  const [messages, setMessages] = useState<{ id: string; role: 'user' | 'assistant'; content: string; attachment?: string }[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<{ url: string; name: string } | null>(null);

  // Reinicia o chat quando muda de empresa para pessoal (ou vice-versa)
  useEffect(() => {
    setMessages([
      { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: `Olá! Sou a NeilAi. Como posso ajudar com as finanças da **${context === 'empresa' ? 'Agência' : 'Casa'}** hoje?` 
      }
    ]);
    setAttachment(null);
  }, [context]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Converte para Base64 (Data URL) para podermos enviar para a IA
    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachment({
        url: event.target?.result as string,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSend = async (e: React.FormEvent | React.KeyboardEvent) => {
    e.preventDefault();
    if ((!localInput.trim() && !attachment) || isLoading) return;
    
    if (listening) {
      SpeechRecognition.stopListening();
      SpeechRecognition.abortListening();
    }
    
    const userMessage = { 
      id: Date.now().toString(), 
      role: 'user' as const, 
      content: localInput || 'Analise este anexo.', 
      attachment: attachment?.url 
    };
    
    setMessages(prev => [...prev, userMessage]);
    setLocalInput('');
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    resetTranscript();
    setIsLoading(true);

    try {
      const res = await fetch('/api/neilai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          data: { context, userName: userData?.name || user?.name || 'Usuário' }
        })
      });

      if (!res.ok) throw new Error('Erro na API');
      const data = await res.json();
      
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant' as const, content: data.text }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant' as const, content: 'Ops, tive um problema de conexão. Pode tentar de novo?' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Se o usuário não estiver logado, não renderiza a NeilAi
  if (!isAuthReady || !user) {
    return null;
  }

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 flex items-center gap-2 px-5 py-3 bg-[#f97316] text-white rounded-full shadow-lg hover:bg-[#ea580c] transition-all z-[9999] font-medium"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
        </svg>
        NeilAi
      </button>
    );
  }

  return (
    <>
      {/* Backdrop (opcional, para dar destaque) */}
      <div 
        className="fixed inset-0 bg-black/20 z-[9998] transition-opacity" 
        onClick={() => setIsOpen(false)}
      />

      {/* Painel do Chat - Inspirado nos Modais do Sistema */}
      <div className={`fixed top-4 right-4 bottom-4 bg-white rounded-2xl shadow-2xl transition-all duration-300 z-[9999] flex flex-col overflow-hidden border border-gray-200 ${isExpanded ? 'w-3/4 max-w-4xl' : 'w-96'}`}>
        
        {/* Cabeçalho Escuro (Estilo Modal de Configurações) */}
        <div className="flex justify-between items-center p-4 bg-[#1a1a1a] text-white">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#f97316]/20 text-[#f97316]">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
              </svg>
            </div>
            <div>
              <h2 className="font-semibold text-base leading-tight">NeilAi</h2>
              <p className="text-xs text-gray-400">Inteligência Financeira</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-gray-400">
            {/* Botão Expandir */}
            <button 
              onClick={() => setIsExpanded(!isExpanded)} 
              className="p-1.5 hover:bg-white/10 hover:text-white rounded-md transition-colors"
              title={isExpanded ? "Encolher" : "Expandir"}
            >
              {isExpanded ? (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg>
              )}
            </button>
            {/* Botão Fechar */}
            <button 
              onClick={() => setIsOpen(false)} 
              className="p-1.5 hover:bg-white/10 hover:text-white rounded-md transition-colors"
              title="Fechar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
        </div>

        {/* Área de Conversa */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 bg-[#f8f9fa]">
          {messages.map((msg, i) => (
            <div 
              key={i} 
              className={`flex flex-col max-w-[85%] ${msg.role !== 'user' ? 'self-start' : 'self-end'}`}
            >
              <span className={`text-[10px] mb-1 px-1 text-gray-500 ${msg.role === 'user' ? 'text-right' : ''}`}>
                {msg.role !== 'user' ? 'NeilAi' : 'Você'}
              </span>
              <div 
                className={`p-3 rounded-2xl text-sm shadow-sm whitespace-pre-wrap ${
                  msg.role !== 'user' 
                    ? 'bg-white border border-gray-100 text-gray-700 rounded-tl-none' 
                    : 'bg-[#1a1a1a] text-white rounded-tr-none'
                }`}
              >
                {msg.attachment && msg.attachment.startsWith('data:image') && (
                  <img src={msg.attachment} alt="Anexo" className="max-w-full rounded-md mb-2 max-h-48 object-cover" />
                )}
                {msg.attachment && msg.attachment.startsWith('data:application/pdf') && (
                  <div className="flex items-center gap-2 bg-white/10 p-2 rounded-md mb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span className="text-xs">Documento PDF</span>
                  </div>
                )}
                {msg.content}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex flex-col max-w-[85%] self-start">
              <span className="text-[10px] mb-1 px-1 text-gray-500">NeilAi</span>
              <div className="p-3 rounded-2xl text-sm shadow-sm bg-white border border-gray-100 text-gray-700 rounded-tl-none flex items-center gap-2">
                <div className="w-2 h-2 bg-[#f97316] rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-[#f97316] rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-[#f97316] rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input de Mensagem */}
        <div className="p-4 bg-white border-t border-gray-100">
          {attachment && (
            <div className="mb-2 flex items-center justify-between bg-orange-50 border border-orange-100 p-2 rounded-lg">
              <div className="flex items-center gap-2 overflow-hidden">
                {attachment.url.startsWith('data:image') ? (
                  <img src={attachment.url} alt="Preview" className="w-8 h-8 object-cover rounded" />
                ) : (
                  <svg className="text-orange-500" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
                )}
                <span className="text-xs text-orange-800 truncate">{attachment.name}</span>
              </div>
              <button onClick={() => setAttachment(null)} className="text-orange-500 hover:text-orange-700">
                <X size={16} />
              </button>
            </div>
          )}
          <form 
            className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full p-1 pl-2 focus-within:border-gray-400 focus-within:ring-1 focus-within:ring-gray-400 transition-all" 
            onSubmit={handleSend}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept="image/*,application/pdf"
            />
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
              title="Anexar Nota ou Fatura"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
            </button>
            
            <input 
              type="text" 
              value={localInput}
              onChange={(e) => setLocalInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(e);
                }
              }}
              disabled={isLoading}
              placeholder={isLoading ? "NeilAi está digitando..." : `Pergunte sobre seus gastos na ${context === 'empresa' ? 'Agência' : 'Casa'}...`}
              className="flex-1 bg-transparent border-none text-sm focus:outline-none focus:ring-0 text-gray-700 placeholder-gray-400"
            />
            {browserSupportsSpeechRecognition && (
              <button
                type="button"
                onClick={toggleListening}
                className={`p-2 rounded-full transition-colors ${listening ? 'bg-red-500 text-white animate-pulse' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                title={listening ? "Ouvindo..." : "Falar"}
              >
                {listening ? <Mic size={18} /> : <MicOff size={18} />}
              </button>
            )}
            <button 
              type="submit" 
              disabled={isLoading || !localInput.trim()}
              className={`p-2 rounded-full text-white transition-colors ${!localInput.trim() || isLoading ? 'bg-gray-300 cursor-not-allowed' : 'bg-[#f97316] hover:bg-[#ea580c]'}`}
            >
              {isLoading ? (
                 <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>
              )}
            </button>
          </form>
          <div className="text-center mt-2">
            <span className="text-[10px] text-gray-400">IA pode cometer erros. Verifique os dados.</span>
          </div>
        </div>

      </div>
    </>
  );
}
