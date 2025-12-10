import React, { useState } from 'react';
import { X, Eye, EyeOff } from 'lucide-react';
import { signUp, signIn } from '../services/authService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type AuthMode = 'login' | 'register';

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      setSuccess(''); // 清除之前的成功提示
      if (mode === 'register') {
        // 注册验证
        if (!username.trim()) {
          throw new Error('用户名不能为空');
        }
        if (password.length < 6) {
          throw new Error('密码长度不能少于6位');
        }
        const { user, error } = await signUp(email, password, username);
        
        if (error) {
          console.error('Authentication error:', error);
          throw error;
        } else if (user) {
          // 确保用户对象存在
          console.log('Authentication successful, user:', user);
          onSuccess();
          onClose();
        } else {
          // 如果用户不存在，可能是注册需要邮箱验证
          console.log('Authentication completed but user is null (may need email verification)');
          setSuccess('注册成功，请检查邮箱进行验证');
        }
      } else {
        // 登录验证
        setSuccess(''); // 清除之前的成功提示
        const { user, error } = await signIn(email, password);
        
        if (error) {
          console.error('Authentication error:', error);
          // 检查是否是邮箱未确认的错误
          if (error.message?.includes('Email not confirmed') || error.message?.includes('邮箱未确认')) {
            setError('邮箱未确认，请先检查邮箱完成验证');
          } else {
            throw error;
          }
        } else if (user) {
          console.log('Authentication successful, user:', user);
          onSuccess();
          onClose();
        } else {
          console.error('Login failed, user not found');
          setError('登录失败，请检查邮箱和密码');
        }
      }
    } catch (err) {
      console.error('Authentication exception:', err);
      setError(err instanceof Error ? err.message : '认证失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-800">
            {mode === 'login' ? '登录' : '注册'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}
        
        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-3 rounded-lg mb-4">
            {success}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username (only for register) */}
          {mode === 'register' && (
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 mb-1">
                用户名
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入用户名"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-light focus:border-transparent"
                required
                disabled={loading}
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              邮箱
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入邮箱"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-light focus:border-transparent"
              required
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              密码
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-light focus:border-transparent pr-10"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
            {mode === 'register' && (
              <p className="text-xs text-slate-500 mt-1">密码长度至少6位</p>
            )}
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full py-3 bg-brand-light text-white font-semibold rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
            disabled={loading}
          >
            {loading ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                处理中...
              </div>
            ) : mode === 'login' ? (
              '登录'
            ) : (
              '注册'
            )}
          </button>
        </form>

        {/* Switch Mode */}
        <div className="mt-6 text-center">
          <p className="text-slate-600">
            {mode === 'login' ? '还没有账号？' : '已有账号？'}
            <button
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError('');
              }}
              className="text-brand-light font-medium ml-1 hover:text-brand-dark transition-colors"
            >
              {mode === 'login' ? '立即注册' : '去登录'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
