import { useState, useEffect, useRef } from 'react';
import {
  collection, query, where, onSnapshot, addDoc, updateDoc,
  doc, getDoc, getDocs, serverTimestamp, Timestamp,
} from 'firebase/firestore';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

function pad(n) { return String(n).padStart(2, '0'); }
function fmt(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/* ─── ProveIt Modal ─── */
function ProveItModal({ challenge, userId, onClose, onPhoto }) {
  const [countdown, setCountdown] = useState(60);
  const [uploading, setUploading] = useState(false);
  const [photoURL, setPhotoURL] = useState(null);
  const fileRef = useRef();
  const isTarget = challenge.to === userId;
  const handledRef = useRef(false);

  useEffect(() => {
    if (!challenge.deadline) return;
    const deadline = challenge.deadline?.toDate?.() || new Date(challenge.deadline);

    const tick = async () => {
      const rem = Math.max(0, Math.floor((deadline.getTime() - Date.now()) / 1000));
      setCountdown(rem);
      if (rem === 0 && !handledRef.current) {
        handledRef.current = true;
        if (isTarget) {
          // Forfeit: mark challenge failed, end battle
          await updateDoc(doc(db, 'proveit', challenge.id), { status: 'failed' });
          const bSnap = await getDoc(doc(db, 'battles', challenge.battleId));
          if (bSnap.exists()) {
            const bd = bSnap.data();
            const winner = bd.challenger === userId ? bd.challenged : bd.challenger;
            await updateDoc(doc(db, 'battles', challenge.battleId), {
              status: 'completed', winner, endTime: serverTimestamp(),
            });
          }
        }
        onClose();
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [challenge.deadline]);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const sRef = storageRef(storage, `proveit/${challenge.id}_${Date.now()}`);
      await uploadBytes(sRef, file);
      const url = await getDownloadURL(sRef);
      setPhotoURL(url);
      await onPhoto(challenge.id, url);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 p-5">
      <div className="bg-[#111] border border-[#2a2a2a] w-full max-w-sm p-6">
        {photoURL ? (
          <div className="text-center">
            <p className="text-green-500 font-bold uppercase tracking-widest mb-3">Proof Submitted ✓</p>
            <img src={photoURL} alt="proof" className="w-full max-h-48 object-cover mb-4" />
            <button onClick={onClose} className="w-full bg-green-500 text-black font-bold py-3 text-sm uppercase tracking-widest">
              Done
            </button>
          </div>
        ) : isTarget ? (
          <>
            <p className="text-yellow-500 text-xs uppercase tracking-widest mb-1">PROVE IT Challenge</p>
            <p className="text-white font-bold text-lg mb-1">Show your desk NOW</p>
            <p className="text-gray-500 text-sm mb-5">or your session ends automatically</p>
            <div className="text-center mb-6">
              <p className={`text-7xl font-black font-mono ${countdown <= 10 ? 'text-red-500 animate-pulse' : 'text-yellow-500'}`}>
                {countdown}
              </p>
              <p className="text-gray-600 text-xs uppercase tracking-widest">seconds</p>
            </div>
            <input type="file" accept="image/*" capture="environment" ref={fileRef} className="hidden" onChange={handleFile} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading || countdown === 0}
              className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:opacity-40 text-black font-black py-4 text-sm uppercase tracking-widest mb-3"
            >
              {uploading ? 'Uploading...' : '📷 Take Photo'}
            </button>
            <button onClick={onClose} className="w-full border border-[#2a2a2a] text-gray-500 py-2.5 text-xs uppercase tracking-widest">
              Dismiss
            </button>
          </>
        ) : (
          <>
            <p className="text-yellow-500 text-xs uppercase tracking-widest mb-1">PROVE IT Sent</p>
            <p className="text-white font-bold text-lg mb-1">Waiting for proof...</p>
            <p className="text-gray-500 text-sm mb-5">They have {countdown}s to respond</p>
            <div className="text-center mb-6">
              <p className={`text-7xl font-black font-mono ${countdown <= 10 ? 'text-red-500 animate-pulse' : 'text-yellow-500'}`}>
                {countdown}
              </p>
              <p className="text-gray-600 text-xs uppercase tracking-widest">seconds</p>
            </div>
            <button onClick={onClose} className="w-full border border-[#2a2a2a] text-gray-500 py-2.5 text-xs uppercase tracking-widest">
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── BattleCard ─── */
function BattleCard({ battle, userId, onAccept, onDecline, onProveIt, onForfeit }) {
  const isChallenger = battle.challenger === userId;
  const oppName = isChallenger ? battle.challengedName : battle.challengerName;
  const [myT, setMyT] = useState(0);
  const [oppT, setOppT] = useState(0);

  useEffect(() => {
    if (battle.status !== 'active' || !battle.startTime) return;
    const start = battle.startTime?.toDate?.() || new Date(battle.startTime);
    const tick = () => {
      const elapsed = Math.max(0, (Date.now() - start.getTime()) / 1000);
      const myPaused  = isChallenger ? (battle.challengerPaused || 0) : (battle.challengedPaused || 0);
      const oppPaused = isChallenger ? (battle.challengedPaused || 0) : (battle.challengerPaused || 0);
      setMyT(Math.floor(elapsed - myPaused));
      setOppT(Math.floor(elapsed - oppPaused));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [battle, isChallenger]);

  const statusColor = battle.status === 'pending'
    ? 'bg-yellow-500/20 text-yellow-400'
    : battle.status === 'active'
    ? 'bg-green-500/20 text-green-400'
    : 'bg-[#1a1a1a] text-gray-500';

  return (
    <div className="bg-[#111] border border-[#2a2a2a] p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-0.5">
            {battle.status === 'pending' ? (isChallenger ? 'Challenge sent to' : 'Challenge from') : 'vs'}
          </p>
          <p className="text-white font-bold">{oppName}</p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 ${statusColor}`}>
          {battle.status}
        </span>
      </div>

      {battle.status === 'active' && (
        <div className="mb-4 space-y-2">
          {[
            { label: 'You', t: myT, green: true },
            { label: oppName, t: oppT, green: false },
          ].map(({ label, t, green }) => (
            <div key={label}>
              <div className="flex justify-between items-center mb-1">
                <span className={`text-[10px] uppercase tracking-widest ${green ? 'text-green-500' : 'text-gray-500'}`}>{label}</span>
                <span className={`font-mono font-bold text-sm ${green ? 'text-green-400' : 'text-gray-300'}`}>{fmt(t)}</span>
              </div>
              <div className="h-1 bg-[#2a2a2a]">
                <div
                  className={`h-full transition-all ${green ? 'bg-green-500' : 'bg-gray-600'}`}
                  style={{ width: `${Math.min(100, (t / Math.max(myT, oppT, 1)) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {battle.status === 'completed' && (
        <div className="mb-3">
          <p className={`font-bold text-sm ${battle.winner === userId ? 'text-green-400' : 'text-red-400'}`}>
            {battle.winner === userId ? '🏆 You Won!' : '💀 You Lost'}
          </p>
          <p className="text-[10px] text-gray-600 mt-1">
            You {fmt(isChallenger ? (battle.challengerDuration || 0) : (battle.challengedDuration || 0))}
            {' vs '}
            {oppName} {fmt(isChallenger ? (battle.challengedDuration || 0) : (battle.challengerDuration || 0))}
          </p>
        </div>
      )}

      <div className="flex gap-2">
        {battle.status === 'pending' && !isChallenger && (
          <>
            <button onClick={() => onAccept(battle.id)} className="flex-1 bg-green-500 text-black font-bold py-2.5 text-xs uppercase tracking-wider">Accept</button>
            <button onClick={() => onDecline(battle.id)} className="flex-1 border border-red-900 text-red-500 font-bold py-2.5 text-xs uppercase tracking-wider">Decline</button>
          </>
        )}
        {battle.status === 'pending' && isChallenger && (
          <button onClick={() => onDecline(battle.id)} className="flex-1 border border-[#2a2a2a] text-gray-500 font-bold py-2.5 text-xs uppercase tracking-wider">Cancel</button>
        )}
        {battle.status === 'active' && (
          <>
            <button onClick={() => onProveIt(battle)} className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-black font-black py-2.5 text-xs uppercase tracking-wider">⚡ PROVE IT</button>
            <button onClick={() => onForfeit(battle.id, isChallenger, myT)} className="flex-1 border border-red-900 text-red-500 font-bold py-2.5 text-xs uppercase tracking-wider">Forfeit</button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function Battles() {
  const { user, profile } = useAuth();
  const [battles, setBattles] = useState([]);
  const [modal, setModal] = useState(null);
  const [input, setInput] = useState('');
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const [tab, setTab] = useState('active');

  // Listen to battles
  useEffect(() => {
    if (!user) return;
    let s1 = { docs: [] }, s2 = { docs: [] };
    const merge = () => {
      const all = [...s1.docs, ...s2.docs]
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((v, i, a) => a.findIndex((x) => x.id === v.id) === i)
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setBattles(all);
    };
    const u1 = onSnapshot(query(collection(db, 'battles'), where('challenger', '==', user.uid)), (s) => { s1 = s; merge(); });
    const u2 = onSnapshot(query(collection(db, 'battles'), where('challenged', '==', user.uid)), (s) => { s2 = s; merge(); });
    return () => { u1(); u2(); };
  }, [user]);

  // Listen for prove-it challenges
  useEffect(() => {
    if (!user) return;
    const activeBattle = battles.find((b) => b.status === 'active');
    if (!activeBattle) return;
    const q = query(
      collection(db, 'proveit'),
      where('battleId', '==', activeBattle.id),
      where('status', '==', 'pending')
    );
    return onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const c = { id: snap.docs[0].id, ...snap.docs[0].data() };
        if (c.to === user.uid || c.from === user.uid) setModal(c);
      } else {
        setModal(null);
      }
    });
  }, [user, battles]);

  async function challenge() {
    setErr('');
    if (!input.trim()) return;
    setSending(true);
    try {
      const q = query(collection(db, 'users'), where('username', '==', input.toLowerCase().trim()));
      const snap = await getDocs(q);
      if (snap.empty) { setErr('User not found'); return; }
      const opp = snap.docs[0].data();
      if (opp.uid === user.uid) { setErr("Can't battle yourself"); return; }
      const existing = await getDocs(
        query(collection(db, 'battles'),
          where('challenger', '==', user.uid),
          where('challenged', '==', opp.uid),
          where('status', '==', 'pending'))
      );
      if (!existing.empty) { setErr('Challenge already sent'); return; }
      await addDoc(collection(db, 'battles'), {
        challenger: user.uid,
        challenged: opp.uid,
        challengerName: profile?.displayName || user.email,
        challengedName: opp.displayName,
        status: 'pending',
        startTime: null,
        challengerDuration: 0,
        challengedDuration: 0,
        winner: null,
        createdAt: serverTimestamp(),
      });
      setInput('');
    } catch { setErr('Something went wrong'); }
    finally { setSending(false); }
  }

  async function acceptBattle(id) {
    await updateDoc(doc(db, 'battles', id), { status: 'active', startTime: serverTimestamp() });
  }

  async function declineBattle(id) {
    await updateDoc(doc(db, 'battles', id), { status: 'declined' });
  }

  async function forfeit(id, isChallenger, myDur) {
    const snap = await getDoc(doc(db, 'battles', id));
    const bd = snap.data();
    const winner = isChallenger ? bd.challenged : bd.challenger;
    await updateDoc(doc(db, 'battles', id), {
      status: 'completed',
      challengerDuration: isChallenger ? myDur : (bd.challengerDuration || 0),
      challengedDuration: isChallenger ? (bd.challengedDuration || 0) : myDur,
      winner,
      endTime: serverTimestamp(),
    });
  }

  async function sendProveIt(battle) {
    const isChallenger = battle.challenger === user.uid;
    const target = isChallenger ? battle.challenged : battle.challenger;
    const deadline = Timestamp.fromDate(new Date(Date.now() + 60000));
    await addDoc(collection(db, 'proveit'), {
      battleId: battle.id,
      from: user.uid,
      to: target,
      deadline,
      status: 'pending',
      photoURL: null,
      createdAt: serverTimestamp(),
    });
  }

  async function submitPhoto(challengeId, url) {
    await updateDoc(doc(db, 'proveit', challengeId), { status: 'completed', photoURL: url });
    setModal(null);
  }

  const active = battles.filter((b) => ['pending', 'active'].includes(b.status));
  const history = battles.filter((b) => ['completed', 'declined'].includes(b.status));
  const shown = tab === 'active' ? active : history;

  return (
    <div className="p-5">
      {modal && (
        <ProveItModal
          challenge={modal}
          userId={user.uid}
          onClose={() => setModal(null)}
          onPhoto={submitPhoto}
        />
      )}

      <div className="pt-3 mb-6">
        <p className="text-xs text-gray-500 uppercase tracking-widest">1v1 Battles</p>
        <h1 className="text-2xl font-black text-white">Battle Arena</h1>
      </div>

      {/* Challenge Input */}
      <div className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Enter opponent's username"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && challenge()}
            className="flex-1 bg-[#111] border border-[#2a2a2a] text-white px-3 py-2.5 text-sm placeholder-gray-700 focus:outline-none focus:border-green-500 transition-colors"
          />
          <button
            onClick={challenge}
            disabled={sending}
            className="bg-green-500 hover:bg-green-400 disabled:opacity-50 text-black font-bold px-4 text-sm uppercase tracking-wider"
          >
            ⚔️
          </button>
        </div>
        {err && <p className="text-red-400 text-xs mt-1.5">{err}</p>}
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-[#2a2a2a] mb-4">
        {[['active', active.length], ['history', history.length]].map(([key, count]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`pb-2 text-xs font-bold uppercase tracking-widest border-b-2 -mb-px transition-all ${
              tab === key ? 'border-green-500 text-green-500' : 'border-transparent text-gray-600'
            }`}
          >
            {key} ({count})
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {shown.map((b) => (
          <BattleCard
            key={b.id}
            battle={b}
            userId={user.uid}
            onAccept={acceptBattle}
            onDecline={declineBattle}
            onProveIt={sendProveIt}
            onForfeit={forfeit}
          />
        ))}
        {shown.length === 0 && (
          <p className="text-gray-600 text-sm text-center py-10">
            {tab === 'active' ? 'No active battles. Challenge someone!' : 'No battle history yet.'}
          </p>
        )}
      </div>
    </div>
  );
}
