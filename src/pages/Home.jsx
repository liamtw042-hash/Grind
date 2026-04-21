import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

function formatElapsed(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const BADGE_META = {
  streak7:   { icon: '🔥', label: '7-Day Streak' },
  streak30:  { icon: '⚡', label: '30-Day Streak' },
  streak100: { icon: '💎', label: '100-Day Legend' },
};

export default function Home() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [activeSession, setActiveSession] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'sessions'),
      where('userId', '==', user.uid),
      where('active', '==', true),
      limit(1)
    );
    return onSnapshot(q, (snap) => {
      setActiveSession(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
    });
  }, [user]);

  useEffect(() => {
    if (!activeSession) { setElapsed(0); return; }
    const start = activeSession.startTime?.toDate?.() || new Date(activeSession.startTime);
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeSession]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const streak = profile?.currentStreak || 0;
  const weeklyHrs = ((profile?.weeklyHours || 0) / 3600).toFixed(1);
  const totalHrs = Math.floor((profile?.totalHours || 0) / 3600);

  const nextBadge = streak < 7 ? { days: 7, prev: 0 } : streak < 30 ? { days: 30, prev: 7 } : streak < 100 ? { days: 100, prev: 30 } : null;
  const streakPct = nextBadge ? Math.min(100, ((streak - nextBadge.prev) / (nextBadge.days - nextBadge.prev)) * 100) : 100;

  return (
    <div className="p-5 space-y-4">
      {/* Header */}
      <div className="pt-3">
        <p className="text-xs text-gray-600 uppercase tracking-widest">{greeting}</p>
        <h1 className="text-3xl font-black text-white mt-0.5">
          {profile?.displayName || user?.email?.split('@')[0]}
        </h1>
      </div>

      {/* Active Session / CTA */}
      {activeSession ? (
        <button
          onClick={() => navigate('/timer')}
          className="w-full bg-green-500 p-4 text-left active:bg-green-400 transition-colors"
        >
          <p className="text-[10px] text-green-900 font-bold uppercase tracking-widest mb-1">● Live Session</p>
          <p className="text-black font-black text-3xl font-mono">{formatElapsed(elapsed)}</p>
          {activeSession.subject && (
            <p className="text-green-900 text-sm mt-1">{activeSession.subject}</p>
          )}
        </button>
      ) : (
        <button
          onClick={() => navigate('/timer')}
          className="w-full border border-[#2a2a2a] hover:border-green-500 p-4 text-left transition-colors group"
        >
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">No active session</p>
          <p className="text-white font-bold group-hover:text-green-500 transition-colors">
            Start Grinding →
          </p>
        </button>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Streak', value: streak, unit: 'days' },
          { label: 'This Week', value: weeklyHrs, unit: 'hrs' },
          { label: 'Total', value: totalHrs, unit: 'hrs' },
        ].map(({ label, value, unit }) => (
          <div key={label} className="bg-[#111] border border-[#2a2a2a] p-3">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">{label}</p>
            <p className="text-xl font-black text-white">
              {value}
              <span className="text-xs text-gray-600 font-normal ml-1">{unit}</span>
            </p>
          </div>
        ))}
      </div>

      {/* Streak Card */}
      {streak > 0 && (
        <div className="bg-[#111] border border-[#2a2a2a] p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">🔥</span>
            <div>
              <p className="text-white font-bold">{streak} day streak</p>
              <p className="text-xs text-gray-500">
                {streak >= 100 ? 'Legend. Absolutely unstoppable.' :
                 streak >= 30  ? 'A whole month. Incredible.' :
                 streak >= 7   ? 'One full week. Keep going!' :
                                 'Building momentum...'}
              </p>
            </div>
          </div>
          {nextBadge && (
            <>
              <div className="flex justify-between text-[10px] text-gray-600 mb-1">
                <span>{streak} days</span>
                <span>{nextBadge.days}-day badge</span>
              </div>
              <div className="h-1 bg-[#2a2a2a]">
                <div className="h-full bg-green-500 transition-all" style={{ width: `${streakPct}%` }} />
              </div>
            </>
          )}
        </div>
      )}

      {/* Badges */}
      {(profile?.badges || []).length > 0 && (
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-2">Badges</p>
          <div className="flex flex-wrap gap-2">
            {profile.badges.map((b) => (
              <div key={b} className="flex items-center gap-2 bg-[#111] border border-[#2a2a2a] px-3 py-2">
                <span className="text-lg">{BADGE_META[b]?.icon}</span>
                <span className="text-xs text-gray-400">{BADGE_META[b]?.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-2 pb-2">
        <button
          onClick={() => navigate('/leaderboard')}
          className="bg-[#111] border border-[#2a2a2a] hover:border-green-500 p-4 text-left transition-colors"
        >
          <div className="text-2xl mb-2">🏆</div>
          <p className="text-white font-semibold text-sm">Leaderboard</p>
          <p className="text-gray-600 text-xs">See who's grinding</p>
        </button>
        <button
          onClick={() => navigate('/battles')}
          className="bg-[#111] border border-[#2a2a2a] hover:border-green-500 p-4 text-left transition-colors"
        >
          <div className="text-2xl mb-2">⚔️</div>
          <p className="text-white font-semibold text-sm">Battles</p>
          <p className="text-gray-600 text-xs">Challenge friends</p>
        </button>
      </div>
    </div>
  );
}
