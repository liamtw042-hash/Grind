import { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

const BADGES = [
  { key: 'streak7',   icon: '🔥', label: '7-Day Streak',    desc: 'Studied 7 days in a row',   threshold: 7,   color: 'text-orange-400', ring: 'border-orange-500/30 bg-orange-500/5' },
  { key: 'streak30',  icon: '⚡', label: '30-Day Streak',   desc: 'Studied 30 days in a row',  threshold: 30,  color: 'text-yellow-400', ring: 'border-yellow-500/30 bg-yellow-500/5' },
  { key: 'streak100', icon: '💎', label: '100-Day Legend',  desc: 'Studied 100 days in a row', threshold: 100, color: 'text-blue-400',   ring: 'border-blue-500/30 bg-blue-500/5' },
];

function fmtHours(secs) { return (secs / 3600).toFixed(1); }

export default function Profile() {
  const { user, profile, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.displayName || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    await updateDoc(doc(db, 'users', user.uid), { displayName: name.trim() });
    setSaving(false);
    setEditing(false);
  }

  const streak = profile?.currentStreak || 0;

  return (
    <div className="p-5 pb-10">
      {/* Header */}
      <div className="pt-3 mb-6 flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Your Profile</p>
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-2xl font-black text-white bg-transparent border-b border-green-500 focus:outline-none w-full"
              autoFocus
            />
          ) : (
            <h1 className="text-2xl font-black text-white truncate">{profile?.displayName}</h1>
          )}
          <p className="text-gray-600 text-sm mt-0.5">@{profile?.username}</p>
        </div>
        <button
          onClick={editing ? save : () => setEditing(true)}
          disabled={saving}
          className="ml-4 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-green-500 transition-colors disabled:opacity-50"
        >
          {editing ? (saving ? '...' : 'Save') : 'Edit'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        {[
          { label: 'Total Hours',   value: fmtHours(profile?.totalHours || 0) },
          { label: 'This Week',     value: fmtHours(profile?.weeklyHours || 0) },
          { label: 'Current Streak', value: `${streak} 🔥` },
          { label: 'Best Streak',   value: `${profile?.longestStreak || 0} days` },
        ].map(({ label, value }) => (
          <div key={label} className="bg-[#111] border border-[#2a2a2a] p-4">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-xl font-black text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Badge Progress */}
      <div className="bg-[#111] border border-[#2a2a2a] p-4 mb-4">
        <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-4">Streak Badges</p>
        <div className="space-y-4">
          {BADGES.map((b) => {
            const unlocked = (profile?.badges || []).includes(b.key);
            const pct = Math.min(100, (streak / b.threshold) * 100);
            return (
              <div key={b.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className={unlocked ? '' : 'opacity-25'}>{b.icon}</span>
                    <span className={`text-xs font-semibold ${unlocked ? b.color : 'text-gray-600'}`}>
                      {b.label}
                    </span>
                    {unlocked && (
                      <span className="text-[9px] bg-green-500/20 text-green-500 px-1.5 py-0.5 uppercase tracking-widest">
                        Unlocked
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-600">{b.threshold}d</span>
                </div>
                <div className="h-1 bg-[#2a2a2a]">
                  <div
                    className={`h-full transition-all ${unlocked ? 'bg-green-500' : 'bg-gray-700'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Earned Badges */}
      {(profile?.badges || []).length > 0 && (
        <div className="mb-6">
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">Earned</p>
          <div className="space-y-2">
            {BADGES.filter((b) => (profile?.badges || []).includes(b.key)).map((b) => (
              <div key={b.key} className={`flex items-center gap-3 p-3 border ${b.ring}`}>
                <span className="text-2xl">{b.icon}</span>
                <div>
                  <p className={`font-bold text-sm ${b.color}`}>{b.label}</p>
                  <p className="text-[10px] text-gray-500">{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Account */}
      <div className="bg-[#111] border border-[#2a2a2a] p-4 mb-4">
        <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-1">Account</p>
        <p className="text-gray-400 text-sm">{user?.email}</p>
      </div>

      {/* Sign Out */}
      <button
        onClick={logout}
        className="w-full border border-red-900/60 hover:border-red-700 text-red-500 hover:text-red-400 font-bold py-3 text-sm uppercase tracking-widest transition-colors"
      >
        Sign Out
      </button>
    </div>
  );
}
