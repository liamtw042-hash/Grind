import { useState, useEffect, useRef } from 'react';
import {
  collection, addDoc, updateDoc, doc, query,
  where, limit, onSnapshot, Timestamp, serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { updateStreakAndStats } from '../lib/streaks';

const SUBJECTS = [
  'Maths', 'English', 'Biology', 'Chemistry',
  'Physics', 'History', 'Geography', 'Economics',
  'Legal', 'Music', 'Art', 'PDHPE', 'Other',
];

function pad(n) { return String(n).padStart(2, '0'); }
function fmt(secs) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function Ring({ elapsed, size = 248 }) {
  const r = (size - 20) / 2;
  const circ = 2 * Math.PI * r;
  const pct = (elapsed % 3600) / 3600;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#1a1a1a" strokeWidth="8" />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke="#22c55e" strokeWidth="8"
        strokeLinecap="butt"
        strokeDasharray={circ}
        strokeDashoffset={circ - pct * circ}
        style={{ transition: 'stroke-dashoffset 0.9s linear' }}
      />
    </svg>
  );
}

export default function Timer() {
  const { user, profile } = useAuth();
  const [subject, setSubject] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [active, setActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pauseStart, setPauseStart] = useState(null);
  const [totalPaused, setTotalPaused] = useState(0);
  const [done, setDone] = useState(null);
  const startRef = useRef(null);
  const intervalRef = useRef(null);

  // Sync with Firestore active session on mount
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'sessions'),
      where('userId', '==', user.uid),
      where('active', '==', true),
      limit(1)
    );
    return onSnapshot(q, (snap) => {
      if (!snap.empty && !active) {
        const d = snap.docs[0].data();
        setSessionId(snap.docs[0].id);
        setSubject(d.subject || '');
        setTotalPaused(d.totalPaused || 0);
        startRef.current = d.startTime?.toDate?.() || new Date(d.startTime);
        setActive(true);
      }
    });
  }, [user]);

  // Tick
  useEffect(() => {
    if (active && !paused) {
      intervalRef.current = setInterval(() => {
        if (startRef.current) {
          const raw = (Date.now() - startRef.current.getTime()) / 1000;
          setElapsed(Math.max(0, Math.floor(raw - totalPaused)));
        }
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [active, paused, totalPaused]);

  async function start() {
    if (!subject) return;
    const now = new Date();
    startRef.current = now;
    setElapsed(0);
    setTotalPaused(0);
    const ref = await addDoc(collection(db, 'sessions'), {
      userId: user.uid,
      subject,
      startTime: Timestamp.fromDate(now),
      active: true,
      totalPaused: 0,
      createdAt: serverTimestamp(),
    });
    setSessionId(ref.id);
    setActive(true);
    setPaused(false);
  }

  function togglePause() {
    if (!paused) {
      setPauseStart(Date.now());
      setPaused(true);
    } else {
      const added = (Date.now() - pauseStart) / 1000;
      const newTotal = totalPaused + added;
      setTotalPaused(newTotal);
      setPauseStart(null);
      setPaused(false);
      if (sessionId) {
        updateDoc(doc(db, 'sessions', sessionId), { totalPaused: newTotal });
      }
    }
  }

  async function stop() {
    if (!sessionId) return;
    const duration = elapsed;
    await updateDoc(doc(db, 'sessions', sessionId), {
      active: false,
      endTime: serverTimestamp(),
      duration,
    });
    await updateStreakAndStats(user.uid, duration);
    setDone({ duration, subject });
    setActive(false);
    setPaused(false);
    setElapsed(0);
    setSessionId(null);
    startRef.current = null;
    setTotalPaused(0);
  }

  if (done) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] p-6 text-center">
        <div className="text-5xl mb-4">✅</div>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-2">Session Complete</p>
        <p className="text-5xl font-black text-green-500 font-mono mb-1">{fmt(done.duration)}</p>
        <p className="text-gray-400 mb-8">{done.subject}</p>
        <button
          onClick={() => setDone(null)}
          className="bg-green-500 hover:bg-green-400 text-black font-black px-8 py-3 text-sm uppercase tracking-widest"
        >
          Grind Again
        </button>
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col items-center">
      <div className="w-full max-w-sm">
        <div className="pt-3 mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-widest">Study Timer</p>
          <h1 className="text-2xl font-black text-white">Grind Mode</h1>
        </div>

        {/* Ring */}
        <div className="flex justify-center relative mb-6">
          <Ring elapsed={elapsed} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-4xl font-black text-white font-mono tabular-nums">{fmt(elapsed)}</p>
            {active && <p className="text-xs text-gray-600 mt-1 uppercase tracking-widest">{subject}</p>}
            {paused && <p className="text-xs text-yellow-500 mt-1 uppercase tracking-widest animate-pulse">PAUSED</p>}
          </div>
        </div>

        {/* Subject Picker */}
        {!active && (
          <div className="mb-6">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">Select Subject</p>
            <div className="flex flex-wrap gap-2">
              {SUBJECTS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSubject(s)}
                  className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border transition-all ${
                    subject === s
                      ? 'bg-green-500 text-black border-green-500'
                      : 'text-gray-500 border-[#2a2a2a] hover:border-gray-500'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Controls */}
        {!active ? (
          <button
            onClick={start}
            disabled={!subject}
            className="w-full bg-green-500 hover:bg-green-400 disabled:bg-[#111] disabled:border disabled:border-[#2a2a2a] disabled:text-gray-600 text-black font-black py-4 text-sm uppercase tracking-widest transition-all"
          >
            {subject ? 'Start Session' : 'Pick a Subject First'}
          </button>
        ) : (
          <div className="flex gap-3">
            <button
              onClick={togglePause}
              className="flex-1 border border-[#2a2a2a] hover:border-yellow-500 text-white hover:text-yellow-500 font-bold py-4 text-sm uppercase tracking-wider transition-all"
            >
              {paused ? 'Resume' : 'Pause'}
            </button>
            <button
              onClick={stop}
              className="flex-1 bg-red-900/80 hover:bg-red-800 text-white font-bold py-4 text-sm uppercase tracking-wider transition-all"
            >
              Stop
            </button>
          </div>
        )}

        {/* Live info */}
        {active && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="bg-[#111] border border-[#2a2a2a] p-3">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Subject</p>
              <p className="text-white font-semibold text-sm">{subject}</p>
            </div>
            <div className="bg-[#111] border border-[#2a2a2a] p-3">
              <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">Streak</p>
              <p className="text-white font-semibold text-sm">{profile?.currentStreak || 0} days 🔥</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
