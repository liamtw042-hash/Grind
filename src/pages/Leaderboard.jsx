import { useState, useEffect } from 'react';
import {
  collection, query, where, getDocs, doc, onSnapshot,
  updateDoc, arrayUnion,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

function fmtHours(secs) {
  const h = secs / 3600;
  return h >= 1 ? `${h.toFixed(1)}h` : `${Math.floor(secs / 60)}m`;
}

function weekRange() {
  const now = new Date();
  const day = now.getDay();
  const mon = new Date(now);
  mon.setDate(now.getDate() - day + (day === 0 ? -6 : 1));
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  return `${fmt(mon)} – ${fmt(sun)}`;
}

export default function Leaderboard() {
  const { user, profile } = useAuth();
  const [board, setBoard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addInput, setAddInput] = useState('');
  const [addErr, setAddErr] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    if (!user || !profile) return;
    const uids = [user.uid, ...(profile.friends || [])];

    let unsubs = [];
    let cache = {};

    function rebuild() {
      const list = Object.values(cache).sort(
        (a, b) => (b.weeklyHours || 0) - (a.weeklyHours || 0)
      );
      setBoard(list);
      setLoading(false);
    }

    uids.forEach((uid) => {
      const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
        if (snap.exists()) cache[uid] = { id: uid, ...snap.data() };
        rebuild();
      });
      unsubs.push(unsub);
    });

    return () => unsubs.forEach((u) => u());
  }, [user, profile?.friends?.join(',')]);

  async function addFriend() {
    setAddErr('');
    if (!addInput.trim()) return;
    setAddLoading(true);
    try {
      const q = query(collection(db, 'users'), where('username', '==', addInput.toLowerCase().trim()));
      const snap = await getDocs(q);
      if (snap.empty) { setAddErr('User not found'); return; }
      const friend = snap.docs[0].data();
      if (friend.uid === user.uid) { setAddErr("That's you!"); return; }
      if ((profile?.friends || []).includes(friend.uid)) { setAddErr('Already added'); return; }
      await updateDoc(doc(db, 'users', user.uid), { friends: arrayUnion(friend.uid) });
      setAddInput('');
    } catch {
      setAddErr('Something went wrong');
    } finally {
      setAddLoading(false);
    }
  }

  const maxHours = board[0]?.weeklyHours || 1;
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="p-5">
      <div className="pt-3 mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-widest">{weekRange()}</p>
        <h1 className="text-2xl font-black text-white">Leaderboard</h1>
      </div>

      {/* Add Friend */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Add friend by username"
            value={addInput}
            onChange={(e) => setAddInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addFriend()}
            className="flex-1 bg-[#111] border border-[#2a2a2a] text-white px-3 py-2.5 text-sm placeholder-gray-700 focus:outline-none focus:border-green-500 transition-colors"
          />
          <button
            onClick={addFriend}
            disabled={addLoading}
            className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold px-4 text-sm uppercase tracking-wider transition-all"
          >
            Add
          </button>
        </div>
        {addErr && <p className="text-red-400 text-xs mt-1.5">{addErr}</p>}
      </div>

      {/* Board */}
      {loading ? (
        <p className="text-gray-600 text-sm">Loading...</p>
      ) : board.length === 0 ? (
        <p className="text-gray-600 text-sm">Add friends to see the leaderboard.</p>
      ) : (
        <div className="space-y-2">
          {board.map((person, i) => {
            const isMe = person.uid === user.uid;
            const pct = ((person.weeklyHours || 0) / maxHours) * 100;
            return (
              <div
                key={person.uid}
                className={`relative overflow-hidden p-4 border ${
                  isMe ? 'border-green-500/40 bg-green-500/5' : 'border-[#2a2a2a] bg-[#111]'
                }`}
              >
                {/* progress bg */}
                <div
                  className={`absolute inset-y-0 left-0 ${isMe ? 'bg-green-500/10' : 'bg-white/5'}`}
                  style={{ width: `${pct}%` }}
                />
                <div className="relative flex items-center gap-3">
                  <span className={`text-xl w-7 text-center font-black ${
                    i === 0 ? 'text-yellow-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-600' : 'text-gray-600'
                  }`}>
                    {i < 3 ? medals[i] : `#${i + 1}`}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm truncate ${isMe ? 'text-green-400' : 'text-white'}`}>
                      {person.displayName}
                      {isMe && <span className="text-[10px] text-green-700 ml-1.5">(you)</span>}
                    </p>
                    <p className="text-[10px] text-gray-600">@{person.username}</p>
                  </div>
                  <div className="text-right">
                    <p className={`font-black text-lg font-mono ${isMe ? 'text-green-400' : 'text-white'}`}>
                      {fmtHours(person.weeklyHours || 0)}
                    </p>
                    {(person.currentStreak || 0) > 0 && (
                      <p className="text-[10px] text-gray-600">{person.currentStreak}🔥</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {board.length > 0 && (
        <p className="text-[10px] text-gray-700 text-center mt-4 uppercase tracking-widest">Resets every Monday</p>
      )}
    </div>
  );
}
