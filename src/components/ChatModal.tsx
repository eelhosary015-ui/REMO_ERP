import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Send,
  Search,
  User,
  MessageCircle,
  Clock,
  Check,
  CheckCheck,
  Paperclip,
  Image as ImageIcon,
  File,
  Download,
} from "lucide-react";
import { useLanguage } from "../contexts/LanguageContext";
import { useAuth } from "../contexts/AuthContext";
import { io, Socket } from "socket.io-client";
import { authHeaders, getBaseUrl } from "../utils/api";

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatUser {
  id: number;
  username: string;
  role: string;
  lastMessage?: string;
  unreadCount?: number;
}

interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  message: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  timestamp: string;
  is_read: boolean;
}

export const ChatModal: React.FC<ChatModalProps> = ({ isOpen, onClose }) => {
  const { isRtl } = useLanguage();
  const { user } = useAuth();
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<ChatUser | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedUserRef = useRef(selectedUser);
  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);

  useEffect(() => {
    if (isOpen && user) {
      fetchUsers();

      const token = localStorage.getItem("token") || "";
      const socket = io(getBaseUrl(), {
        auth: { token },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 2000,
      });
      socketRef.current = socket;

      socket.emit("join", user.id);

      socket.on("chat:receive", (msg: Message) => {
        if (
          selectedUserRef.current &&
          (msg.sender_id === selectedUserRef.current.id ||
            msg.receiver_id === selectedUserRef.current.id)
        ) {
          setMessages((prev) => [...prev, msg]);
          if (msg.sender_id === selectedUserRef.current.id) {
            markAsRead(selectedUserRef.current.id);
          }
        }
        fetchUsers();
      });

      socket.on("chat:sent", (msg: Message) => {
        if (selectedUserRef.current && msg.receiver_id === selectedUserRef.current.id) {
          setMessages((prev) => [...prev, msg]);
        }
        fetchUsers();
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [isOpen, user]);

  useEffect(() => {
    if (selectedUser) {
      fetchMessages(selectedUser.id);
      markAsRead(selectedUser.id);
    }
  }, [selectedUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/chat/users", {
        headers: {
          ...authHeaders(),
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error("Failed to fetch chat users:", error);
    }
  };

  const fetchMessages = async (userId: number) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/chat/messages/${userId}`, {
        headers: {
          ...authHeaders(),
        },
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async (userId: number) => {
    try {
      await fetch(`/api/chat/read/${userId}`, {
        method: "POST",
        headers: {
          ...authHeaders(),
        },
      });
    } catch (error) {
      console.error("Failed to mark messages as read:", error);
    }
  };

  const handleSendMessage = (e?: React.FormEvent, attachment?: any) => {
    if (e) e.preventDefault();
    if (!selectedUser || !user || !socketRef.current) return;

    if (!newMessage.trim() && !attachment) return;

    const messageData = {
      senderId: user.id,
      receiverId: selectedUser.id,
      message: newMessage.trim(),
      ...attachment,
    };

    socketRef.current.emit("chat:send", messageData);
    setNewMessage("");
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedUser) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/chat/upload", {
        method: "POST",
        headers: {
          ...authHeaders(),
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        handleSendMessage(undefined, {
          file_url: data.file_url,
          file_name: data.file_name,
          file_type: data.file_type,
        });
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const isImage = (type?: string) => type?.startsWith("image/");

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[600px] flex overflow-hidden border border-slate-200"
          >
            {/* Sidebar: Users List */}
            <div
              className={`w-1/3 border-slate-100 flex flex-col bg-slate-50/50 ${isRtl ? "border-l" : "border-r"}`}
            >
              <div className="p-4 border-b border-slate-100">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-800 text-lg">
                    {isRtl ? "المحادثات" : "Messages"}
                  </h3>
                  <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                </div>
                <div className="relative">
                  <Search
                    className={`absolute ${isRtl ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400`}
                  />
                  <input
                    type="text"
                    value={searchQuery ?? ""}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isRtl ? "بحث..." : "Search..."}
                    className={`w-full bg-white border border-slate-200 rounded-xl py-2 ${isRtl ? "pr-10 pl-4" : "pl-10 pr-4"} text-sm outline-none focus:border-blue-500 transition-all`}
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUser(u)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                        selectedUser?.id === u.id
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-100"
                          : "hover:bg-white text-slate-700"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          selectedUser?.id === u.id
                            ? "bg-white/20"
                            : "bg-slate-200"
                        }`}
                      >
                        <User className="w-5 h-5" />
                      </div>
                      <div className="flex-1 text-right overflow-hidden">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="font-bold text-sm truncate">
                            {u.username}
                          </span>
                          <span
                            className={`text-[10px] opacity-70 ${selectedUser?.id === u.id ? "text-white" : "text-slate-500"}`}
                          >
                            {u.role}
                          </span>
                        </div>
                        {u.lastMessage && (
                          <p
                            className={`text-[10px] truncate ${selectedUser?.id === u.id ? "text-white/80" : "text-slate-400 font-medium"}`}
                          >
                            {u.lastMessage}
                          </p>
                        )}
                      </div>
                      {u.unreadCount ? (
                        <div className="bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 animate-pulse">
                          {u.unreadCount}
                        </div>
                      ) : null}
                    </button>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-slate-300 gap-2 opacity-50">
                    <User className="w-8 h-8" />
                    <span className="text-xs font-bold">
                      {isRtl ? "لا يوجد مستخدمين" : "No users found"}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Main: Chat Area */}
            <div className="flex-1 flex flex-col bg-white">
              {selectedUser ? (
                <>
                  {/* Chat Header */}
                  <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-800 text-sm">
                          {selectedUser.username}
                        </h4>
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            {selectedUser.role}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={onClose}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Messages */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-50/30">
                    {messages.map((msg, index) => {
                      const isMe = msg.sender_id === user?.id;
                      return (
                        <div
                          key={msg.id || index}
                          className={`flex ${isMe ? "justify-start" : "justify-end"}`}
                        >
                          <div
                            className={`max-w-[80%] flex flex-col ${isMe ? "items-start" : "items-end"}`}
                          >
                            <div
                              className={`p-3 rounded-2xl text-sm font-bold shadow-sm space-y-2 ${
                                isMe
                                  ? "bg-blue-600 text-white rounded-tr-none"
                                  : "bg-white text-slate-800 border border-slate-100 rounded-tl-none"
                              }`}
                            >
                              {msg.file_url ? (
                                isImage(msg.file_type) ? (
                                  <div className="rounded-lg overflow-hidden border border-white/20">
                                    <img
                                      src={msg.file_url}
                                      alt={msg.file_name}
                                      className="max-w-full h-auto max-h-[300px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                      onClick={() =>
                                        window.open(msg.file_url, "_blank")
                                      }
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                ) : (
                                  <a
                                    href={msg.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`flex items-center gap-3 p-2 rounded-lg border ${
                                      isMe
                                        ? "bg-white/10 border-white/20 text-white"
                                        : "bg-slate-50 border-slate-200 text-slate-700"
                                    } hover:opacity-80 transition-opacity`}
                                  >
                                    <div
                                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                        isMe
                                          ? "bg-white/20"
                                          : "bg-blue-100 text-blue-600"
                                      }`}
                                    >
                                      <File className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 overflow-hidden">
                                      <p className="text-[10px] font-bold truncate">
                                        {msg.file_name}
                                      </p>
                                      <p className="text-[8px] opacity-60 uppercase">
                                        {msg.file_type?.split("/")[1]}
                                      </p>
                                    </div>
                                    <Download className="w-3 h-3 shrink-0" />
                                  </a>
                                )
                              ) : null}
                              {msg.message && <div>{msg.message}</div>}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 px-1">
                              <span className="text-[9px] text-slate-400 font-bold">
                                {new Date(msg.timestamp).toLocaleTimeString(
                                  [],
                                  { hour: "2-digit", minute: "2-digit" },
                                )}
                              </span>
                              {isMe &&
                                (msg.is_read ? (
                                  <CheckCheck className="w-3 h-3 text-blue-500" />
                                ) : (
                                  <Check className="w-3 h-3 text-slate-300" />
                                ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </div>

                  {/* Input Area */}
                  <form
                    onSubmit={handleSendMessage}
                    className="p-4 border-t border-slate-100 space-y-3"
                  >
                    <div className="flex gap-2">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className="w-10 h-10 rounded-xl border border-slate-200 text-slate-400 flex items-center justify-center hover:bg-slate-50 transition-all hover:text-blue-600 hover:border-blue-200"
                        title={isRtl ? "إرفاق ملف" : "Attach File"}
                      >
                        {isUploading ? (
                          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        ) : (
                          <Paperclip className="w-5 h-5" />
                        )}
                      </button>
                      <input
                        type="text"
                        value={newMessage ?? ""}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={
                          isRtl ? "اكتب رسالة..." : "Type a message..."
                        }
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all text-slate-800"
                      />
                      <button
                        type="submit"
                        disabled={
                          (!newMessage.trim() && !isUploading) || isUploading
                        }
                        className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
                      >
                        <Send
                          className={`w-5 h-5 ${isRtl ? "rotate-180" : ""}`}
                        />
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-4 opacity-50 p-12 text-center">
                  <div className="w-20 h-20 rounded-3xl bg-slate-100 flex items-center justify-center">
                    <MessageCircle className="w-10 h-10" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 mb-1">
                      {isRtl
                        ? "مرحباً في نظام المراسلة"
                        : "Welcome to Messages"}
                    </h4>
                    <p className="text-xs font-bold max-w-[200px] leading-relaxed">
                      {isRtl
                        ? "اختر أحد الزملاء من القائمة الجانبية لبدء المحادثة"
                        : "Select a colleague from the sidebar to start a conversation"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
