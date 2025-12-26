
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { AVATARS, COLORS, API_CONFIG_KEY, getApiUrl } from '../constants';

interface LoginViewProps {
  onLogin: (user: User) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [customId, setCustomId] = useState('');
  const [password, setPassword] = useState('');
  
  const [loginId, setLoginId] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [passStrength, setPassStrength] = useState(0); // 0: None, 1: Weak, 2: Medium, 3: Strong

  // Server Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [serverUrl, setServerUrl] = useState('');

  useEffect(() => {
    const savedUrl = localStorage.getItem(API_CONFIG_KEY) || '';
    setServerUrl(savedUrl);
  }, []);

  // Password Analysis Logic (Real-time)
  useEffect(() => {
    if (mode === 'register') {
        if (!password) {
            setPassStrength(0);
            return;
        }

        let score = 0;

        // Rule 1: Length >= 6
        if (password.length >= 6) {
            score = 1; // Base score for length
        } else {
            setPassStrength(0); // Too short
            return;
        }
        
        // Rule 2: Mix of Letters and Numbers (Required for Medium)
        const hasLetters = /[a-zA-Z]/.test(password);
        const hasNumbers = /[0-9]/.test(password);
        if (hasLetters && hasNumbers) score = 2;

        // Rule 3: Bonus for length >= 10 OR Special Chars (Strong)
        const hasSpecial = /[^a-zA-Z0-9]/.test(password);
        if (score === 2 && (password.length >= 10 || hasSpecial)) score = 3;

        setPassStrength(score);
    }
  }, [password, mode]);

  const saveServerSettings = () => {
    localStorage.setItem(API_CONFIG_KEY, serverUrl.trim());
    setIsSettingsOpen(false);
    alert("Đã lưu địa chỉ Server! Kết nối sẽ được áp dụng ngay.");
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const trimmedId = customId.trim();
    const trimmedUser = username.trim();
    const trimmedPass = password.trim();

    if (!trimmedId || !trimmedUser || !trimmedPass) {
      setError('Vui lòng điền đầy đủ thông tin!');
      setIsLoading(false);
      return;
    }

    // --- Validate ID Length ---
    if (trimmedId.length < 5) {
        setError('ID quá ngắn! Phải có ít nhất 5 ký tự.');
        setIsLoading(false);
        return;
    }

    // --- Validate Password Strength ---
    // Must be at least Level 2 (Medium: Length >= 6 AND Mixed chars)
    if (passStrength < 2) {
        if (trimmedPass.length < 6) {
             setError('Mật khẩu quá ngắn (tối thiểu 6 ký tự).');
        } else {
             setError('Mật khẩu quá yếu! Vui lòng thêm cả chữ và số.');
        }
        setIsLoading(false);
        return;
    }

    // Create new user object
    const randomAvatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];

    const newUser: User = {
      id: trimmedId,
      username: trimmedUser,
      password: trimmedPass, // This will be hashed on server
      avatar: randomAvatar,
      color: randomColor,
      nameColor: 'text-cyan-400', 
      credits: 50, 
    };

    try {
      const apiUrl = getApiUrl('/api/users');
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'register', user: newUser }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Đăng ký thất bại');
      } else {
        onLogin(data.user); // data.user has the token now
      }
    } catch (err) {
      setError('Không thể kết nối đến Server! Hãy kiểm tra cài đặt Host.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const trimmedId = loginId.trim();
    const trimmedPass = loginPassword.trim();

    if (!trimmedId || !trimmedPass) {
        setError('Vui lòng nhập ID và Mật khẩu!');
        setIsLoading(false);
        return;
    }

    try {
      const apiUrl = getApiUrl('/api/users');
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'login', id: trimmedId, password: trimmedPass }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Đăng nhập thất bại');
      } else {
        onLogin(data.user);
      }
    } catch (err) {
      setError('Không thể kết nối đến Server! Hãy kiểm tra cài đặt Host.');
    } finally {
      setIsLoading(false);
    }
  };

  // Helper render function for strength bars
  const renderStrengthBars = () => {
    if (!password) return null;
    
    let text = '';
    let textColor = 'text-gray-400';
    
    // Determine Text & Color
    if (passStrength === 0) {
        text = 'Quá ngắn (< 6 ký tự)';
        textColor = 'text-gray-400';
    } else if (passStrength === 1) {
        text = 'Yếu (Thêm số hoặc chữ)';
        textColor = 'text-red-400';
    } else if (passStrength === 2) {
        text = 'Trung bình (Được chấp nhận)';
        textColor = 'text-yellow-400';
    } else if (passStrength === 3) {
        text = 'Rất mạnh (Tuyệt vời)';
        textColor = 'text-emerald-400';
    }

    return (
        <div className="mt-3 animate-fade-in w-full">
            {/* The Bars */}
            <div className="flex gap-1.5 h-1.5 mb-2 w-full">
                {/* Bar 1: Weak */}
                <div className={`flex-1 rounded-full transition-all duration-500 ease-out 
                    ${passStrength >= 1 
                        ? (passStrength === 1 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' 
                            : passStrength === 2 ? 'bg-yellow-500' 
                            : 'bg-emerald-500') 
                        : 'bg-white/10'}`}
                ></div>
                
                {/* Bar 2: Medium */}
                <div className={`flex-1 rounded-full transition-all duration-500 ease-out 
                    ${passStrength >= 2 
                        ? (passStrength === 2 ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]' 
                            : 'bg-emerald-500') 
                        : 'bg-white/10'}`}
                ></div>
                
                {/* Bar 3: Strong */}
                <div className={`flex-1 rounded-full transition-all duration-500 ease-out 
                    ${passStrength >= 3 
                        ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]' 
                        : 'bg-white/10'}`}
                ></div>
            </div>
            
            {/* The Text Label */}
            <div className="flex justify-between items-center">
                <span className={`text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 ${textColor}`}>
                    {text}
                </span>
                {passStrength >= 2 && (
                    <i className="fas fa-check-circle text-emerald-400 text-xs animate-scale-in"></i>
                )}
            </div>
        </div>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-0 sm:p-4">
        
      {/* Settings Button */}
      <button 
        onClick={() => setIsSettingsOpen(true)}
        className="fixed top-4 right-4 z-50 w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-cyan-400 hover:text-white hover:bg-white/10 transition-all backdrop-blur-md"
      >
        <i className="fas fa-cog animate-spin-slow" style={{animationDuration: '10s'}}></i>
      </button>

      {/* Main Container - Full Screen on Mobile */}
      <div className="w-full sm:max-w-md h-[100dvh] sm:h-auto glass-panel rounded-none sm:rounded-3xl p-6 sm:p-8 shadow-none sm:shadow-2xl animate-scale-in relative overflow-hidden flex flex-col justify-center border-0 sm:border">
        
        {/* Glow Effects */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-cyan-500/20 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-600/20 rounded-full blur-3xl"></div>

        <div className="text-center mb-8 relative z-10">
          <div className="w-24 h-24 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full mx-auto flex items-center justify-center mb-4 shadow-lg shadow-cyan-500/30 animate-pulse-glow">
            <i className="fas fa-water text-5xl text-white"></i>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-wider drop-shadow-md">
            OCEAN<span className="text-cyan-400">CHAT</span>
          </h1>
          <p className="text-blue-300 text-sm mt-1">Kết nối từ đáy đại dương</p>
        </div>

        {/* Tabs */}
        <div className="flex bg-black/40 p-1 rounded-2xl mb-6 border border-white/5 relative z-10">
          <button 
            onClick={() => { setMode('register'); setError(''); }}
            disabled={isLoading}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
              mode === 'register' 
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/50' 
              : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Đăng ký
          </button>
          <button 
            onClick={() => { setMode('login'); setError(''); }}
            disabled={isLoading}
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
              mode === 'login' 
              ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg shadow-cyan-900/50' 
              : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Đăng nhập
          </button>
        </div>

        {error && (
            <div className="bg-red-900/40 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl mb-6 text-sm flex items-center gap-2 animate-shake relative z-10">
                <i className="fas fa-exclamation-triangle text-red-400"></i> {error}
            </div>
        )}

        {mode === 'register' ? (
            <form onSubmit={handleRegister} className="space-y-5 animate-slide-up relative z-10">
                <div className="group">
                    <label className="block text-xs font-bold text-cyan-300 mb-1.5 uppercase tracking-wider ml-1">Tên hiển thị</label>
                    <div className="relative">
                        <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500/70"></i>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Tên của bạn..."
                            className="w-full pl-11 pr-4 py-3.5 rounded-2xl glass-input outline-none transition-all placeholder-blue-300/30"
                            required
                        />
                    </div>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-cyan-300 mb-1.5 uppercase tracking-wider ml-1">Tạo ID mới</label>
                    <div className="relative">
                        <i className="fas fa-id-badge absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500/70"></i>
                        <input
                            type="text"
                            value={customId}
                            onChange={(e) => setCustomId(e.target.value)}
                            placeholder="Ví dụ: haidang99 (Min 5 ký tự)"
                            className="w-full pl-11 pr-4 py-3.5 rounded-2xl glass-input outline-none transition-all placeholder-blue-300/30 font-mono"
                            required
                        />
                    </div>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-cyan-300 mb-1.5 uppercase tracking-wider ml-1">Mật khẩu</label>
                    <div className="relative">
                        <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500/70"></i>
                        <input
                            type={showPassword ? "text" : "password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="6+ ký tự (Gồm chữ và số)"
                            className={`w-full pl-11 pr-12 py-3.5 rounded-2xl glass-input outline-none transition-all placeholder-blue-300/30 ${passStrength > 0 && passStrength < 2 ? 'border-red-500/50 focus:border-red-500' : ''}`}
                            required
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-500/50 hover:text-cyan-400 focus:outline-none p-2"
                        >
                            <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                    </div>
                    {/* Password Strength Meter Component */}
                    {renderStrengthBars()}
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-cyan-900/40 transition-all hover:scale-[1.02] active:scale-95 mt-4 group flex items-center justify-center gap-2"
                >
                    {isLoading ? (
                        <>
                            <i className="fas fa-spinner fa-spin"></i> Đang xử lý...
                        </>
                    ) : (
                        <>
                            Lặn xuống ngay <i className="fas fa-arrow-right ml-2 group-hover:translate-x-1 transition-transform"></i>
                        </>
                    )}
                </button>
                <p className="text-center text-xs text-cyan-200/60 mt-4"><i className="fas fa-gift text-yellow-400"></i> +50 Oxygen Credits</p>
            </form>
        ) : (
            <form onSubmit={handleLogin} className="space-y-5 animate-slide-up relative z-10">
                 <div className="group">
                    <label className="block text-xs font-bold text-cyan-300 mb-1.5 uppercase tracking-wider ml-1">Nhập ID</label>
                    <div className="relative">
                        <i className="fas fa-id-card absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500/70"></i>
                        <input
                            type="text"
                            value={loginId}
                            onChange={(e) => setLoginId(e.target.value)}
                            placeholder="ID tài khoản..."
                            className="w-full pl-11 pr-4 py-3.5 rounded-2xl glass-input outline-none transition-all placeholder-blue-300/30 font-mono"
                            required
                        />
                    </div>
                </div>

                <div className="group">
                    <label className="block text-xs font-bold text-cyan-300 mb-1.5 uppercase tracking-wider ml-1">Mật khẩu</label>
                    <div className="relative">
                        <i className="fas fa-key absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500/70"></i>
                        <input
                            type={showPassword ? "text" : "password"}
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="••••••"
                            className="w-full pl-11 pr-12 py-3.5 rounded-2xl glass-input outline-none transition-all placeholder-blue-300/30"
                            required
                        />
                        <button 
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-cyan-500/50 hover:text-cyan-400 focus:outline-none p-2"
                        >
                            <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-2xl font-bold text-lg shadow-xl shadow-cyan-900/40 transition-all hover:scale-[1.02] active:scale-95 mt-6 group flex items-center justify-center gap-2"
                >
                     {isLoading ? (
                        <>
                            <i className="fas fa-spinner fa-spin"></i> Đang tải...
                        </>
                    ) : (
                        <>
                            Đăng nhập <i className="fas fa-sign-in-alt ml-2 group-hover:translate-x-1 transition-transform"></i>
                        </>
                    )}
                </button>
            </form>
        )}
      </div>

      {/* Server Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
             <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-fade-in" onClick={() => setIsSettingsOpen(false)}></div>
             <div className="glass-panel border border-cyan-500/30 p-6 rounded-2xl w-full max-w-sm relative z-10 animate-scale-in">
                <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2">
                    <i className="fas fa-server text-cyan-400"></i> Cài đặt Server
                </h3>
                <p className="text-xs text-gray-400 mb-4">Nhập đường dẫn Host của bạn (bỏ trống nếu dùng Server mặc định).</p>
                
                <div className="mb-4">
                    <label className="block text-xs font-bold text-cyan-300 mb-1.5 uppercase tracking-wider">Host URL</label>
                    <input 
                        type="text" 
                        value={serverUrl}
                        onChange={(e) => setServerUrl(e.target.value)}
                        placeholder="https://my-chat-server.vercel.app"
                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:border-cyan-500 outline-none text-sm font-mono"
                    />
                </div>

                <div className="flex gap-3">
                    <button onClick={() => setIsSettingsOpen(false)} className="flex-1 py-3 bg-white/5 text-gray-300 rounded-xl font-bold text-sm">Hủy</button>
                    <button onClick={saveServerSettings} className="flex-1 py-3 bg-cyan-600 text-white rounded-xl font-bold text-sm">Lưu</button>
                </div>
             </div>
        </div>
      )}
    </div>
  );
};
