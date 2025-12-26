
import React, { useState, useEffect } from 'react';
import { User, View } from './types';
import { LoginView } from './components/LoginView';
import { ChatView } from './components/ChatView';
import { getApiUrl } from './constants';

const USER_SESSION_KEY = 'gemini_chat_current_session_v2';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState<View>(View.LOGIN);
  const [isInitializing, setIsInitializing] = useState(true);

  // 1. Kiểm tra session khi mở app
  useEffect(() => {
    try {
      const savedSession = localStorage.getItem(USER_SESSION_KEY);
      if (savedSession) {
        const parsedUser = JSON.parse(savedSession);
        
        // Kiểm tra xem có token không, nếu không có token (phiên bản cũ) thì bắt đăng nhập lại để lấy token
        if (!parsedUser.token) {
             localStorage.removeItem(USER_SESSION_KEY);
             setIsInitializing(false);
             return;
        }

        // Cố gắng Verify token với server
        const apiUrl = getApiUrl('/api/users');
        fetch(apiUrl, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'verify', id: parsedUser.id, token: parsedUser.token })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success && data.user) {
                setCurrentUser(data.user);
                // Cập nhật lại session mới nhất (giữ token)
                localStorage.setItem(USER_SESSION_KEY, JSON.stringify(data.user));
            } else {
                // Token hết hạn hoặc không hợp lệ -> Logout
                console.log("Phiên đăng nhập hết hạn");
                localStorage.removeItem(USER_SESSION_KEY);
                setCurrentUser(null);
            }
        })
        .catch(() => {
            // Lỗi mạng: Tạm thời tin tưởng cache LocalStorage để user vào được app (Offline mode)
            setCurrentUser(parsedUser);
        })
        .finally(() => {
            if (currentUser || parsedUser) setCurrentView(View.CHAT);
            setIsInitializing(false);
        });
      } else {
          setIsInitializing(false);
      }
    } catch (error) {
      console.error("Failed to load user session:", error);
      localStorage.removeItem(USER_SESSION_KEY);
      setIsInitializing(false);
    }
  }, []);

  const handleLogin = (user: User) => {
    setCurrentUser(user);
    setCurrentView(View.CHAT);
    // Lưu user vào storage, bao gồm cả Token (nhưng API đã xóa password rồi)
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(user));
  };

  const handleLogout = () => {
    localStorage.removeItem(USER_SESSION_KEY);
    setCurrentUser(null);
    setCurrentView(View.LOGIN);
  };

  const handleUpdateUser = (updatedUser: User) => {
    // Đảm bảo giữ lại token khi update profile
    const secureUser = { ...updatedUser, token: currentUser?.token };
    setCurrentUser(secureUser);
    
    // 1. Cập nhật Cache Local
    localStorage.setItem(USER_SESSION_KEY, JSON.stringify(secureUser));

    // 2. Cập nhật lên Server Database (Fire and forget)
    const apiUrl = getApiUrl('/api/users');
    fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', user: secureUser })
    }).catch(err => console.error("Sync to server failed:", err));
  };

  if (isInitializing) {
    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center flex-col gap-4">
            <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-cyan-400 text-sm font-bold tracking-widest animate-pulse">ĐANG KẾT NỐI VỆ TINH...</p>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      {currentView === View.LOGIN ? (
        <LoginView onLogin={handleLogin} />
      ) : (
        currentUser && (
          <ChatView 
            currentUser={currentUser} 
            onLogout={handleLogout} 
            onUpdateUser={handleUpdateUser}
          />
        )
      )}
    </div>
  );
};

export default App;
