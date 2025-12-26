
import React, { useState, useEffect, useRef } from 'react';
import { User, Message, Notification } from '../types';
import { getGeminiResponse } from '../services/geminiService';
import { SHOP_ITEMS, getApiUrl } from '../constants';

interface ChatViewProps {
  currentUser: User;
  onLogout: () => void;
  onUpdateUser: (user: User) => void;
}

const LOCAL_STORAGE_KEY = 'gemini_group_chat_messages';

export const ChatView: React.FC<ChatViewProps> = ({ currentUser, onLogout, onUpdateUser }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  
  // Menu States
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  
  // Reply State
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  // Selection State (Toggle Time/Reply)
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);

  // Notification State
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Profile Edit State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isProfileModalClosing, setIsProfileModalClosing] = useState(false);
  const [editName, setEditName] = useState(currentUser.username);
  const [editAvatar, setEditAvatar] = useState(currentUser.avatar);

  // Shop State
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [isShopClosing, setIsShopClosing] = useState(false);
  const [purchaseAnimation, setPurchaseAnimation] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Helper to load from LS
  const loadFromLocal = () => {
      try {
          const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (saved) {
              return JSON.parse(saved);
          }
      } catch (e) {
          console.error("LS Load Error", e);
      }
      return [];
  };

  // Helper to save to LS
  const saveToLocal = (newMessages: Message[]) => {
      try {
          // Keep only last 100 messages to save space
          const toSave = newMessages.slice(-100); 
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(toSave));
      } catch (e) {
          console.error("LS Save Error", e);
      }
  };

  // Function to fetch messages from API with Fallback
  const fetchMessages = async () => {
    try {
      const apiUrl = getApiUrl('/api/chat');
      const res = await fetch(apiUrl, { 
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' } 
      });

      if (res.status === 404 || res.status === 500) {
        throw new Error("Offline Mode");
      }

      const data = await res.json();
      
      if (data.messages && Array.isArray(data.messages)) {
        setMessages(prev => {
          // Compare ID of last message to avoid unnecessary re-renders
          if (prev.length > 0 && data.messages.length > 0) {
             const lastPrev = prev[prev.length - 1];
             const lastNew = data.messages[data.messages.length - 1];
             if (lastPrev.id === lastNew.id && prev.length === data.messages.length) {
                 return prev;
             }
          }
          return data.messages;
        });
        setIsOfflineMode(false);
      }
    } catch (error) {
      // Switch to Local Storage Mode silently
      if (!isOfflineMode) setIsOfflineMode(true);
      
      const localMsgs = loadFromLocal();
      setMessages(prev => {
          if (prev.length === 0 && localMsgs.length > 0) return localMsgs;
          if (localMsgs.length > prev.length) return localMsgs;
          return prev;
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const intervalId = setInterval(fetchMessages, 3000); // Poll every 3s
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (messages.length === 0) return;

    const newNotifications: Notification[] = [];
    const myNameTag = `@${currentUser.username.toLowerCase()}`;
    const seenIds = new Set(notifications.map(n => n.messageId));

    messages.forEach(msg => {
      if (msg.userId === currentUser.id) return;
      if (seenIds.has(msg.id)) return;

      const isMention = msg.text.toLowerCase().includes(myNameTag);
      const isReply = msg.replyTo?.username === currentUser.username; 

      if (isMention || isReply) {
         newNotifications.push({
           id: `notif-${msg.id}`,
           messageId: msg.id,
           senderName: msg.username,
           text: msg.text,
           timestamp: msg.timestamp,
           type: isReply ? 'reply' : 'mention',
           isRead: false
         });
      }
    });

    if (newNotifications.length > 0) {
      setNotifications(prev => {
        const updated = [...newNotifications.reverse(), ...prev].slice(0, 50);
        return updated;
      });
      setUnreadCount(prev => prev + newNotifications.length);
    }
  }, [messages, currentUser.id, currentUser.username]);

  useEffect(() => {
    if (scrollRef.current) {
        const isNearBottom = scrollRef.current.scrollHeight - scrollRef.current.scrollTop - scrollRef.current.clientHeight < 300;
        if (isNearBottom || messages.length < 20) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }
  }, [messages, isAiThinking]);

  const sendMessageToApi = async (msg: Message) => {
    // 1. Optimistic Update (Show immediately)
    setMessages(prev => {
        const updated = [...prev, msg];
        saveToLocal(updated);
        return updated;
    });

    // 2. Try sending to Server
    try {
      const apiUrl = getApiUrl('/api/chat');
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...msg,
          replyTo: msg.replyTo ? {
            id: msg.replyTo.id,
            username: msg.replyTo.username,
            text: msg.replyTo.text
          } : undefined
        }),
      });
      if (!res.ok) throw new Error("API Failed");
    } catch (error) {
      console.log("Message saved locally (Offline mode)");
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    // Grant 1 Credit for sending a message
    const updatedCredits = (currentUser.credits || 0) + 1;
    const updatedUser = { ...currentUser, credits: updatedCredits };
    onUpdateUser(updatedUser);

    const userMsg: Message = {
      id: Date.now().toString() + Math.random().toString().substr(2, 5),
      userId: currentUser.id,
      username: currentUser.username,
      avatar: currentUser.avatar,
      text: inputText.trim(),
      timestamp: Date.now(),
      userColor: currentUser.nameColor, // Pass current text color
      replyTo: replyingTo ? {
        id: replyingTo.id,
        username: replyingTo.username,
        text: replyingTo.text
      } : undefined
    };

    setInputText('');
    setReplyingTo(null);
    await sendMessageToApi(userMsg);

    const shouldAiReply = inputText.toLowerCase().includes('@gemini');

    if (shouldAiReply) {
      setIsAiThinking(true);
      const context = messages.slice(-10).map(m => `${m.username}: ${m.text}`).join('\n');
      const aiReplyText = await getGeminiResponse(inputText, context);
      
      const aiMsg: Message = {
        id: 'ai-' + Date.now(),
        userId: 'gemini-ai',
        username: 'Gemini AI',
        text: aiReplyText || '...',
        timestamp: Date.now(),
        isAi: true,
        avatar: 'https://avatar.vercel.sh/gemini',
        replyTo: {
            id: userMsg.id,
            username: userMsg.username,
            text: userMsg.text
        }
      };
      
      setTimeout(async () => {
        setIsAiThinking(false);
        await sendMessageToApi(aiMsg);
      }, 1000);
    }
  };

  const handleReplyClick = (msg: Message) => {
    setReplyingTo(msg);
    inputRef.current?.focus();
  };

  const handleMessageClick = (msgId: string) => {
    if (selectedMessageId === msgId) {
        setSelectedMessageId(null);
    } else {
        setSelectedMessageId(msgId);
    }
  };

  const handleNotificationClick = (notif: Notification) => {
    setIsNotificationsOpen(false); // Close notif menu
    
    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));

    const element = document.getElementById(`msg-${notif.messageId}`);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.classList.add('bg-cyan-900/50', 'transition-colors', 'duration-1000');
        setTimeout(() => element.classList.remove('bg-cyan-900/50'), 2000);
        setSelectedMessageId(notif.messageId); // Auto select the message
    } else {
        alert("Tin nhắn này có thể đã quá cũ.");
    }
  };

  const copyIdToClipboard = () => {
      navigator.clipboard.writeText(currentUser.id);
      alert(`Đã sao chép ID: ${currentUser.id}\nHãy lưu lại để đăng nhập sau này!`);
  };

  // Menu Handlers - Mutual Exclusion
  const openMenu = () => {
      setIsNotificationsOpen(false);
      setIsMenuOpen(true);
  };

  const openNotifications = () => {
      setIsMenuOpen(false);
      setIsNotificationsOpen(true);
  };

  const handleOpenProfile = () => {
    setEditName(currentUser.username);
    setEditAvatar(currentUser.avatar);
    setIsProfileModalOpen(true);
    setIsMenuOpen(false);
  };

  const closeProfileModal = () => {
    setIsProfileModalClosing(true);
    setTimeout(() => {
        setIsProfileModalOpen(false);
        setIsProfileModalClosing(false);
    }, 200); 
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (editName.trim()) {
      onUpdateUser({
        ...currentUser,
        username: editName.trim(),
        avatar: editAvatar.trim() || currentUser.avatar
      });
      closeProfileModal();
    }
  };

  // Shop Handlers
  const handleOpenShop = () => {
      setIsShopOpen(true);
      setIsMenuOpen(false);
  };

  const closeShop = () => {
      setIsShopClosing(true);
      setTimeout(() => {
          setIsShopOpen(false);
          setIsShopClosing(false);
          setPurchaseAnimation(null);
      }, 200);
  };

  const handleBuyColor = (item: {id: string, class: string, price: number}) => {
      if ((currentUser.credits || 0) >= item.price) {
          onUpdateUser({
              ...currentUser,
              nameColor: item.class,
              credits: (currentUser.credits || 0) - item.price
          });
          setPurchaseAnimation(item.id);
          // Visual feedback reset
          setTimeout(() => setPurchaseAnimation(null), 1000);
      } else {
          alert("Không đủ tiền! Hãy chat nhiều hơn để kiếm thêm credits.");
      }
  };

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden relative">
      
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 glass-panel border-b-0 sticky top-0 z-20 shadow-lg shadow-cyan-900/20">
        <div className="flex items-center gap-3">
            <div className="relative animate-scale-in group cursor-pointer" onClick={openMenu}>
                <div className="absolute inset-0 bg-cyan-500 rounded-full blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <img src={currentUser.avatar} className="w-10 h-10 rounded-full object-cover border-2 border-cyan-500/50 relative z-10" alt="Me"/>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-black rounded-full z-20 animate-pulse"></div>
            </div>
          <div>
            <h2 className="font-bold text-lg leading-tight text-white animate-fade-in tracking-wide drop-shadow-md">Ocean<span className="text-cyan-400">Chat</span></h2>
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 bg-black/30 px-2 py-0.5 rounded-full border border-white/5">
                    <div className={`w-1.5 h-1.5 rounded-full ${isOfflineMode ? 'bg-orange-500' : 'bg-emerald-400 animate-pulse'}`}></div>
                    <p className={`text-[9px] font-bold tracking-widest ${isOfflineMode ? 'text-orange-400' : 'text-emerald-400'}`}>
                        {isOfflineMode ? 'LOST SIGNAL' : 'LIVE'}
                    </p>
                </div>
                <div className="flex items-center gap-1 bg-yellow-500/10 px-2 py-0.5 rounded-full border border-yellow-500/20">
                    <i className="fas fa-coins text-yellow-400 text-[9px]"></i>
                    <span className="text-[10px] font-bold text-yellow-400">{currentUser.credits || 0}</span>
                </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={openNotifications}
                className="relative w-10 h-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-cyan-200 transition-all active:scale-95 border border-white/5"
            >
                <i className="fas fa-bell"></i>
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center animate-bounce shadow-lg shadow-red-500/50">
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>
            <button 
                onClick={openMenu}
                className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white shadow-lg shadow-cyan-600/30 transition-all hover:brightness-110 active:scale-95"
            >
                <i className="fas fa-bars"></i>
            </button>
        </div>
      </header>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-6 scroll-smooth"
      >
        {isLoading && messages.length === 0 && (
            <div className="flex justify-center items-center h-full flex-col gap-3 animate-pulse opacity-70">
                <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-cyan-400 text-xs tracking-widest uppercase">Đang kết nối vệ tinh...</span>
            </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.userId === currentUser.id;
          const isSelected = selectedMessageId === msg.id;

          return (
            <div key={msg.id} id={`msg-${msg.id}`} className={`flex flex-col mb-4 ${isMe ? 'items-end' : 'items-start'} animate-slide-up`}>
              
              <div className={`flex max-w-[85%] ${isMe ? 'flex-row-reverse' : 'flex-row'} gap-3 items-end group`}>
                {!isMe && (
                  <div className="flex flex-col items-center gap-1 mb-1">
                      <div className={`w-9 h-9 rounded-2xl overflow-hidden flex-shrink-0 border-2 ${msg.isAi ? 'border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'border-cyan-900 shadow-lg'}`}>
                        <img 
                        src={msg.isAi ? 'https://avatar.vercel.sh/gemini' : (msg.avatar || `https://ui-avatars.com/api/?name=${msg.username}&background=random`)} 
                        alt="User" 
                        className="w-full h-full object-cover"
                        />
                      </div>
                  </div>
                )}
                
                <div className="flex flex-col relative">
                  {!isMe && (
                    <span className={`text-[10px] mb-1 px-1 font-bold uppercase tracking-wider ${msg.isAi ? 'text-purple-400' : (msg.userColor || 'text-cyan-600')}`}>
                      {msg.username}
                    </span>
                  )}

                  {msg.replyTo && (
                      <div className={`
                        text-xs p-2 mb-1 rounded-xl opacity-90 cursor-pointer flex flex-col border-l-2 backdrop-blur-sm
                        ${isMe ? 'bg-black/20 text-blue-200 border-blue-300' : 'bg-black/20 text-cyan-200 border-cyan-700'}
                      `}
                      onClick={() => {
                          const el = document.getElementById(`msg-${msg.replyTo?.id}`);
                          if(el) el.scrollIntoView({behavior:'smooth', block:'center'});
                          if(msg.replyTo?.id) setSelectedMessageId(msg.replyTo.id);
                      }}
                      >
                          <span className="font-bold text-[10px] opacity-70 mb-0.5 flex items-center gap-1">
                              <i className="fas fa-reply"></i> 
                              {msg.replyTo.username}
                          </span>
                          <span className="line-clamp-1 italic text-[11px] opacity-80">{msg.replyTo.text}</span>
                      </div>
                  )}

                  <div 
                    onClick={() => handleMessageClick(msg.id)}
                    className={`
                    px-5 py-3 rounded-2xl text-sm break-words relative transition-all duration-300 ease-out cursor-pointer border
                    ${isMe 
                      ? 'bg-gradient-to-br from-cyan-600 to-blue-700 text-white rounded-br-none border-cyan-500/30 shadow-[0_4px_15px_rgba(8,145,178,0.3)]' 
                      : msg.isAi 
                        ? 'bg-gradient-to-br from-purple-900/80 to-indigo-900/80 text-purple-100 border-purple-500/40 rounded-bl-none shadow-[0_4px_15px_rgba(147,51,234,0.2)] backdrop-blur-md'
                        : 'glass-panel text-gray-100 rounded-bl-none border-white/10'
                    }
                    ${isSelected ? 'scale-[1.02] shadow-xl z-10' : 'hover:brightness-110'}
                  `}>
                    {msg.text}
                  </div>
                  
                  {/* Meta Data */}
                  <div className={`
                    overflow-hidden transition-all duration-300 ease-in-out flex items-center gap-3 text-[10px]
                    ${isSelected ? 'max-h-[40px] opacity-100 mt-2' : 'max-h-0 opacity-0 mt-0'}
                    ${isMe ? 'justify-end pr-1 text-cyan-300' : 'justify-start pl-1 text-gray-400'}
                  `}>
                        <span className="opacity-70 font-mono">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <button 
                            onClick={(e) => {
                                e.stopPropagation();
                                handleReplyClick(msg);
                            }}
                            className="flex items-center gap-1 text-cyan-400 hover:text-white transition-colors bg-white/5 px-3 py-1 rounded-full border border-white/10"
                        >
                            <i className="fas fa-reply"></i> Trả lời
                        </button>
                  </div>

                </div>
              </div>
            </div>
          );
        })}

        {isAiThinking && (
          <div className="flex justify-start pl-12 animate-fade-in">
            <div className="flex gap-1.5 bg-black/40 px-4 py-3 rounded-2xl rounded-bl-none border border-purple-500/30">
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce shadow-[0_0_10px_rgba(192,132,252,0.8)]"></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.15s] shadow-[0_0_10px_rgba(192,132,252,0.8)]"></div>
                <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce [animation-delay:-0.3s] shadow-[0_0_10px_rgba(192,132,252,0.8)]"></div>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 pb-safe z-30">
        <div className="glass-panel rounded-[2rem] p-1.5 border border-white/10 shadow-2xl backdrop-blur-xl bg-black/40">
            {replyingTo && (
                <div className="px-4 py-2 flex justify-between items-center border-b border-white/5 mb-1 bg-white/5 rounded-t-[1.5rem] mx-1">
                    <div className="flex flex-col text-sm border-l-2 border-cyan-400 pl-3">
                        <span className="text-cyan-400 font-bold text-[10px] uppercase">Đang trả lời {replyingTo.username}</span>
                        <span className="text-gray-300 truncate max-w-[200px] text-xs opacity-70">{replyingTo.text}</span>
                    </div>
                    <button 
                        onClick={() => setReplyingTo(null)}
                        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 transition-colors"
                    >
                        <i className="fas fa-times text-xs"></i>
                    </button>
                </div>
            )}

            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <button type="button" className="w-10 h-10 rounded-full flex items-center justify-center text-cyan-400 hover:text-white hover:bg-white/10 transition-colors active:scale-90">
                <i className="fas fa-plus text-lg"></i>
            </button>
            <div className="flex-1 relative">
                <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={replyingTo ? `Trả lời ${replyingTo.username}...` : "Nhắn tin..."}
                className="w-full bg-transparent border-none text-white py-3 px-2 focus:ring-0 placeholder-gray-500/80 font-medium"
                />
                <button 
                type="button"
                className="absolute right-0 top-1/2 -translate-y-1/2 text-cyan-500/50 hover:text-cyan-400 transition-colors p-2"
                onClick={() => setInputText(prev => prev + ' @gemini ')}
                >
                <i className="fas fa-robot"></i>
                </button>
            </div>
            <button
                type="submit"
                disabled={!inputText.trim()}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-300 ${
                inputText.trim() 
                ? 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white scale-100 shadow-[0_0_15px_rgba(6,182,212,0.5)] rotate-0' 
                : 'bg-white/5 text-gray-600 scale-90 rotate-45'
                }`}
            >
                <i className="fas fa-paper-plane"></i>
            </button>
            </form>
        </div>
      </div>

      {/* Main Menu Drawer */}
      <>
        {isMenuOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
            onClick={() => setIsMenuOpen(false)}
          />
        )}
        
        <div 
          className={`fixed top-0 right-0 h-full w-[85%] max-w-[320px] glass-panel border-l border-white/10 z-50 shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${
            isMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
            <div className="p-6 flex justify-between items-center bg-gradient-to-b from-white/5 to-transparent">
              <h3 className="font-bold text-xl text-white tracking-widest uppercase drop-shadow">Hồ sơ</h3>
              <button 
                onClick={() => setIsMenuOpen(false)} 
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-90"
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4">
                {/* User Info Block */}
                <div className="py-6 flex flex-col items-center relative mb-4">
                    <div className="w-24 h-24 p-1 rounded-full border-2 border-dashed border-cyan-500/50 mb-4 animate-spin-slow" style={{animationDuration: '10s'}}>
                        <img src={currentUser.avatar} alt="Me" className="w-full h-full rounded-full object-cover animate-none-imp" style={{animationDirection: 'reverse'}} />
                    </div>
                    <h4 className={`font-bold text-xl mb-1 ${currentUser.nameColor || 'text-white'}`}>{currentUser.username}</h4>
                    
                    <button 
                      onClick={copyIdToClipboard}
                      className="flex items-center gap-2 text-xs text-cyan-200/60 hover:text-cyan-400 bg-black/30 px-3 py-1.5 rounded-full transition-colors border border-white/5 hover:border-cyan-500/30"
                    >
                      {/* Changed icon from fingerprint to id-badge */}
                      <i className="fas fa-id-badge"></i>
                      <span className="font-mono tracking-wider">{currentUser.id}</span>
                      <i className="far fa-copy ml-1"></i>
                    </button>

                    <div className="mt-6 flex items-center gap-3 bg-gradient-to-r from-yellow-900/40 to-yellow-600/10 px-6 py-2 rounded-2xl border border-yellow-500/20 shadow-lg">
                        <i className="fas fa-coins text-yellow-400 text-lg drop-shadow"></i>
                        <span className="font-bold text-xl text-yellow-100">{currentUser.credits || 0}</span>
                    </div>
                </div>

                {/* Shop Button */}
                <button 
                    onClick={handleOpenShop}
                    className="w-full py-4 bg-gradient-to-r from-purple-900/80 to-blue-900/80 hover:from-purple-800 hover:to-blue-800 text-white rounded-2xl font-bold flex items-center justify-between px-6 shadow-lg shadow-purple-900/20 transition-all hover:scale-[1.02] border border-white/10 group mb-4"
                >
                    <span className="flex items-center gap-3">
                        <i className="fas fa-store text-purple-400 group-hover:animate-bounce"></i> 
                        Cửa hàng
                    </span>
                    <i className="fas fa-chevron-right text-xs opacity-50"></i>
                </button>

                {/* Settings Links */}
                <div className="space-y-2">
                    <button 
                        onClick={handleOpenProfile}
                        className="w-full py-3 flex items-center gap-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl px-4 transition-colors"
                    >
                        <i className="fas fa-user-cog w-6 text-center text-cyan-500/70"></i> Chỉnh sửa hồ sơ
                    </button>
                    <button className="w-full py-3 flex items-center gap-3 text-gray-300 hover:text-white hover:bg-white/5 rounded-xl px-4 transition-colors">
                        <i className="fas fa-shield-alt w-6 text-center text-cyan-500/70"></i> Bảo mật
                    </button>
                </div>
            </div>

            {/* Logout */}
            <div className="p-6 border-t border-white/5 bg-black/20">
              <button 
                onClick={onLogout}
                className="w-full py-3.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <i className="fas fa-power-off"></i>
                Ngắt kết nối
              </button>
            </div>
        </div>
      </>

      {/* Shop Modal */}
      {isShopOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div 
              className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity ${isShopClosing ? 'animate-fade-out' : 'animate-fade-in'}`} 
              onClick={closeShop}
            ></div>
            <div className={`glass-panel border border-cyan-500/30 p-0 rounded-[2rem] w-full max-w-sm relative z-10 shadow-[0_0_50px_rgba(8,145,178,0.3)] flex flex-col h-[75vh] overflow-hidden ${isShopClosing ? 'animate-scale-out' : 'animate-scale-in'}`}>
                
                {/* Header */}
                <div className="p-6 bg-gradient-to-b from-cyan-900/50 to-transparent">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="text-2xl font-bold text-white tracking-wide">Kho báu</h3>
                            <p className="text-xs text-cyan-300/60 mt-1">Trang bị màu sắc cho tên của bạn</p>
                        </div>
                        <div className="bg-black/40 px-3 py-1 rounded-full border border-yellow-500/30 flex items-center gap-1.5">
                             <i className="fas fa-coins text-yellow-400 text-sm"></i>
                             <span className="font-bold text-yellow-400">{currentUser.credits || 0}</span>
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 p-6 pt-0">
                    {SHOP_ITEMS.map((item) => {
                        const isEquipped = currentUser.nameColor === item.class;
                        return (
                            <div key={item.id} className={`p-4 rounded-2xl border flex justify-between items-center group transition-all duration-300 ${isEquipped ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-white/5 border-white/5 hover:border-white/20'}`}>
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-black/30 border border-white/10`}>
                                        <i className={`fas fa-paint-brush ${item.class}`}></i>
                                    </div>
                                    <div>
                                        <h4 className={`font-bold text-base ${item.class}`}>{item.name}</h4>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">Neon Color</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleBuyColor(item)}
                                    disabled={isEquipped}
                                    className={`px-4 py-2 rounded-xl font-bold text-xs transition-all active:scale-95 flex items-center gap-1.5 ${
                                        isEquipped 
                                        ? 'bg-transparent text-cyan-400 cursor-default border border-cyan-500/30' 
                                        : (currentUser.credits || 0) >= item.price
                                            ? 'bg-yellow-500 text-black hover:bg-yellow-400 shadow-lg shadow-yellow-900/20'
                                            : 'bg-white/5 text-gray-500 cursor-not-allowed'
                                    }`}
                                >
                                    {isEquipped ? (
                                        <i className="fas fa-check"></i>
                                    ) : purchaseAnimation === item.id ? (
                                        <i className="fas fa-spinner fa-spin"></i>
                                    ) : (
                                        <> {item.price} <i className="fas fa-coins text-[8px]"></i></>
                                    )}
                                </button>
                            </div>
                        )
                    })}
                </div>

                <div className="p-4 bg-black/20 border-t border-white/5">
                    <button onClick={closeShop} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors font-bold text-sm uppercase tracking-wider">
                        Đóng kho báu
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Notifications Drawer */}
      <>
        {isNotificationsOpen && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-fade-in"
            onClick={() => setIsNotificationsOpen(false)}
          />
        )}
        
        <div 
          className={`fixed top-0 right-0 h-full w-[85%] max-w-[320px] glass-panel border-l border-white/10 z-50 shadow-2xl transform transition-transform duration-300 ease-out flex flex-col ${
            isNotificationsOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
            <div className="p-6 flex justify-between items-center bg-gradient-to-b from-white/5 to-transparent">
              <h3 className="font-bold text-xl text-white tracking-widest uppercase drop-shadow">Thông báo</h3>
              <div className="flex gap-2">
                 {unreadCount > 0 && (
                    <button 
                        onClick={() => {setNotifications([]); setUnreadCount(0);}}
                        className="text-cyan-400 hover:text-white text-xs px-2 py-1 bg-cyan-500/10 rounded-lg active:scale-95 transition-transform"
                    >
                        Xóa hết
                    </button>
                )}
                <button 
                    onClick={() => setIsNotificationsOpen(false)} 
                    className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-all active:scale-90"
                >
                    <i className="fas fa-times"></i>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 pt-0">
                <div className="space-y-2">
                    {notifications.length === 0 ? (
                        <div className="text-center py-20 text-cyan-500/30 animate-fade-in flex flex-col items-center">
                            <div className="w-16 h-16 rounded-full bg-cyan-500/5 flex items-center justify-center mb-3">
                                <i className="far fa-bell-slash text-2xl"></i>
                            </div>
                            <p className="text-sm">Yên tĩnh tuyệt đối...</p>
                        </div>
                    ) : (
                        notifications.map((notif) => (
                            <div 
                                key={notif.id}
                                onClick={() => handleNotificationClick(notif)}
                                className={`p-4 rounded-xl cursor-pointer transition-all border flex gap-3 animate-slide-up ${notif.isRead ? 'bg-black/20 border-transparent opacity-60' : 'bg-cyan-900/20 border-cyan-500/30 shadow-lg'}`}
                            >
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${notif.type === 'reply' ? 'bg-blue-500/20 text-blue-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                    <i className={`fas ${notif.type === 'reply' ? 'fa-reply' : 'fa-at'} text-xs`}></i>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-200">
                                        <span className="font-bold text-white">{notif.senderName}</span>
                                        {notif.type === 'reply' ? ' trả lời:' : ' nhắc đến:'}
                                    </p>
                                    <p className="text-xs text-gray-400 truncate mt-1 italic pl-2 border-l-2 border-white/10">"{notif.text}"</p>
                                    <p className="text-[9px] text-cyan-500/60 mt-2 text-right">
                                        {new Date(notif.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
      </>

      {/* Edit Profile Modal */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div 
              className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity ${isProfileModalClosing ? 'animate-fade-out' : 'animate-fade-in'}`} 
              onClick={closeProfileModal}
            ></div>
            <div className={`glass-panel border border-white/10 p-6 rounded-[2rem] w-full max-w-sm relative z-10 shadow-2xl ${isProfileModalClosing ? 'animate-scale-out' : 'animate-scale-in'}`}>
                <h3 className="text-xl font-bold text-white mb-6 tracking-wide text-center">Hồ Sơ Cá Nhân</h3>
                <form onSubmit={handleSaveProfile} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1.5 ml-1 uppercase">Tên hiển thị</label>
                        <input 
                            type="text"
                            className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3.5 text-white focus:border-cyan-500 outline-none transition-all placeholder-gray-600" 
                            value={editName} 
                            onChange={e => setEditName(e.target.value)} 
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1.5 ml-1 uppercase">Link Avatar</label>
                        <input 
                            type="text"
                            className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3.5 text-white focus:border-cyan-500 outline-none placeholder-gray-600 text-sm transition-all" 
                            value={editAvatar} 
                            onChange={e => setEditAvatar(e.target.value)}
                            placeholder="https://..."
                        />
                    </div>
                    <div className="flex gap-3 pt-4">
                        <button type="button" onClick={closeProfileModal} className="flex-1 py-3.5 bg-white/5 text-gray-300 rounded-2xl hover:bg-white/10 transition-colors font-bold text-sm">Đóng</button>
                        <button type="submit" className="flex-1 py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl font-bold hover:brightness-110 transition-transform active:scale-95 shadow-lg shadow-cyan-900/30 text-sm">Lưu thay đổi</button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};
