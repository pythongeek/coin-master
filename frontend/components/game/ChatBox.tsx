"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Users, MessageCircle } from "lucide-react";
import { io } from "socket.io-client";

interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: string;
}

export default function ChatBox() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [room, setRoom] = useState("global");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:4001");
    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join_room", { room });
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("chat_message", (msg: ChatMessage) => {
      setMessages((prev) => [...prev.slice(-99), msg]); // Keep last 100
    });

    socket.on("chat_deleted", (data: { id: string }) => {
      setMessages((prev) => prev.filter((m) => m.id !== data.id));
    });

    return () => {
      socket.disconnect();
    };
  }, [room]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim() || !socketRef.current) return;
    socketRef.current.emit("chat_message", { room, content: input.trim() });
    setInput("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 flex flex-col h-[400px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-medium text-slate-300">Live Chat</h3>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-green-400" : "bg-red-400"}`} />
          <span className="text-slate-500">{isConnected ? "Connected" : "Disconnected"}</span>
        </div>
      </div>

      {/* Room selector */}
      <div className="px-4 py-2 border-b border-slate-700/50 flex gap-2">
        <button
          onClick={() => setRoom("global")}
          className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            room === "global"
              ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
              : "bg-slate-700/50 text-slate-400 hover:bg-slate-700"
          }`}
        >
          <Users className="w-3 h-3 inline mr-1" />
          Global
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-slate-600 text-sm mt-8">
            No messages yet. Say hello!
          </p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center text-xs text-amber-400 font-bold shrink-0">
              {msg.username[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-amber-400">{msg.username}</span>
                <span className="text-xs text-slate-600">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <p className="text-sm text-slate-300 break-words">{msg.content}</p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-slate-700/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder="Type a message..."
            maxLength={500}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || !isConnected}
            className="px-3 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-700 disabled:text-slate-500 text-slate-950 rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
