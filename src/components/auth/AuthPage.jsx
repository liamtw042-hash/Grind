import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function AuthPage() {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        if (username.length < 3) throw new Error('Username must be at least 3 characters');
        await register(email, password, displayName, username);
      }
      navigate('/');
    } catch (err) {
      setError(
        err.message
          .replace('Firebase: ', '')
          .replace(/\s*\(auth\/[^)]+\)/, '')
          .trim()
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen min-h-dvh bg-black flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="text-6xl font-black tracking-tighter text-white mb-2">GRIND</div>
          <div className="text-xs text-gray-600 uppercase tracking-[0.3em]">Study. Compete. Win.</div>
        </div>

        <div className="w-full max-w-sm">
          {/* Mode Tabs */}
          <div className="flex border border-[#2a2a2a] mb-5">
            {['login', 'register'].map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-all ${
                  mode === m ? 'bg-green-500 text-black' : 'text-gray-600 hover:text-white'
                }`}
              >
                {m === 'login' ? 'Sign In' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <>
                <input
                  type="text"
                  placeholder="Display Name"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-[#111] border border-[#2a2a2a] text-white px-4 py-3 text-sm placeholder-gray-700 focus:outline-none focus:border-green-500 transition-colors"
                  required
                />
                <input
                  type="text"
                  placeholder="Username (letters, numbers, _)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
                  className="w-full bg-[#111] border border-[#2a2a2a] text-white px-4 py-3 text-sm placeholder-gray-700 focus:outline-none focus:border-green-500 transition-colors"
                  required
                />
              </>
            )}
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-[#111] border border-[#2a2a2a] text-white px-4 py-3 text-sm placeholder-gray-700 focus:outline-none focus:border-green-500 transition-colors"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#111] border border-[#2a2a2a] text-white px-4 py-3 text-sm placeholder-gray-700 focus:outline-none focus:border-green-500 transition-colors"
              required
            />

            {error && (
              <div className="text-red-400 text-xs px-3 py-2 bg-red-900/20 border border-red-800/50">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-black py-3.5 text-sm uppercase tracking-widest transition-all mt-1"
            >
              {loading ? '...' : mode === 'login' ? 'Enter' : 'Create Account'}
            </button>
          </form>
        </div>
      </div>

      <div className="text-center pb-8 text-xs text-gray-800 uppercase tracking-widest">
        Built for HSC students who mean business.
      </div>
    </div>
  );
}
