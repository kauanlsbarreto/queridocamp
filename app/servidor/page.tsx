"use client"

import { useState, useEffect, useRef, FormEvent } from "react";
import { io, Socket } from "socket.io-client";
import { Terminal, Send, Wifi, WifiOff, Trash2, Lock, Activity } from "lucide-react";
import { motion } from "framer-motion";

const SOCKET_URL = "http://localhost:3001";

export default function AdminConsole() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [command, setCommand] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [lastTick, setLastTick] = useState(new Date()); 
  
  const isAdmin = true; 

  const logsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setLastTick(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    const newSocket = io(SOCKET_URL, {
      transports: ["websocket"],
      reconnection: true,
    });

    newSocket.on("connect", () => {
      setIsConnected(true);
      addLog("[CLIENTE] Conectado ao servidor de controle.");
    });

    newSocket.on("disconnect", () => {
      setIsConnected(false);
      addLog("[CLIENTE] Desconectado do servidor.");
    });

    newSocket.on("console:output", (data: string) => {
      addLog(data);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [isAdmin]);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const addLog = (text: string) => {
    setLogs((prev) => [...prev.slice(-200), text]);
  };

  const handleSendCommand = (e: FormEvent) => {
    e.preventDefault();
    if (!command.trim() || !socket) return;
    socket.emit("console:command", command);
    setHistory((prev) => [...prev, command]);
    setHistoryIndex(-1);
    setCommand("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCommand(history[newIndex]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = Math.min(history.length - 1, historyIndex + 1);
        setHistoryIndex(newIndex);
        setCommand(history[newIndex]);
      } else {
        setCommand("");
      }
    }
  };

  const clearConsole = () => {
    setLogs([]);
    inputRef.current?.focus();
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center text-red-500 gap-2 font-mono">
        <Lock /> ACESSO NEGADO
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-gray-200 font-mono flex flex-col items-center p-4 md:p-8 pt-24 md:pt-32">
      
      <div className="w-full max-w-4xl flex flex-col h-[85vh] shadow-2xl">
        
        <div className="flex justify-between items-center bg-[#111] p-4 rounded-t-xl border border-gray-800 border-b-0">
          <div className="flex items-center gap-3">
            <div className="bg-gray-800 p-2 rounded-lg">
              <Terminal className="text-yellow-500 w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-white text-lg tracking-wider underline decoration-yellow-500/30">QUERIDO CAMP</h1>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">CS2 RCON Interface</p>
                <span className="text-[10px] text-gray-600">|</span>
                <div className="flex items-center gap-1 text-[10px] text-green-500/80">
                   <Activity size={10} className="animate-pulse" /> 
                   LIVE: {lastTick.toLocaleTimeString()}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-all ${isConnected ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-red-900/30 text-red-400 border border-red-800'}`}>
              {isConnected ? <Wifi size={14} className="animate-bounce" /> : <WifiOff size={14} />}
              {isConnected ? "ONLINE" : "OFFLINE"}
            </div>
            <button 
              onClick={clearConsole}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
              title="Limpar Console"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Console Output Area */}
        <div 
          className="flex-1 bg-[#050505] border border-gray-800 overflow-y-auto p-4 shadow-inner custom-scrollbar relative"
          onClick={() => inputRef.current?.focus()}
        >
          {logs.length === 0 && (
            <div className="text-gray-700 text-center mt-20 italic animate-pulse">
              Aguardando pacotes UDP / RCON...
            </div>
          )}
          
          {logs.map((log, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, x: -5 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-1 break-words whitespace-pre-wrap text-[13px] leading-relaxed border-l border-transparent hover:border-yellow-500/30 pl-2 transition-colors"
            >
              <span className={`
                ${log.startsWith('>') ? 'text-yellow-500 font-bold' : ''}
                ${log.includes('[ERRO]') ? 'text-red-400' : ''}
                ${log.includes('[SISTEMA]') || log.includes('[CLIENTE]') ? 'text-blue-400 font-semibold' : ''}
                ${!log.startsWith('>') && !log.includes('[') ? 'text-gray-300' : ''}
              `}>
                {log}
              </span>
            </motion.div>
          ))}
          <div ref={logsEndRef} />
        </div>

        {/* Input Area Original Restaurada */}
        <div className="bg-[#111] p-4 rounded-b-xl border border-gray-800 border-t-0">
          <form onSubmit={handleSendCommand} className="relative flex items-center gap-2">
            <span className="text-yellow-500 font-bold select-none text-lg leading-none">{">"}</span>
            <input
              ref={inputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite um comando RCON (ex: status, maps)..."
              className="flex-1 bg-transparent border-none outline-none text-white placeholder-gray-600 h-10 font-mono text-sm"
              autoFocus
              autoComplete="off"
            />
            <button 
              type="submit" 
              disabled={!isConnected || !command.trim()}
              className="bg-yellow-600 hover:bg-yellow-500 disabled:opacity-30 disabled:grayscale text-black p-2 rounded-lg transition-all shadow-lg active:scale-95"
            >
              <Send size={18} />
            </button>
          </form>
          <div className="mt-2 text-[10px] text-gray-600 flex justify-between uppercase tracking-tighter">
            <span>↑ ↓ Histórico de Comandos</span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              WebSocket Secure Ativo
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}