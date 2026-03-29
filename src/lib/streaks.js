import { doc, updateDoc, getDoc, increment } from 'firebase/firestore';
import { db } from './firebase';

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now);
  monday.setDate(diff);
  return monday.toISOString().split('T')[0];
}

export async function updateStreakAndStats(uid, sessionDuration) {
  if (sessionDuration < 60) return; // Minimum 1 minute to count

  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return;
  const profile = userSnap.data();

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const lastStudy = profile.lastStudyDate || null;

  let newStreak = profile.currentStreak || 0;

  if (lastStudy === today) {
    // Already counted today — no streak change
  } else if (lastStudy === yesterday || !lastStudy) {
    newStreak += 1;
  } else {
    // Streak broken
    newStreak = 1;
  }

  const newBadges = [...(profile.badges || [])];
  if (newStreak >= 7 && !newBadges.includes('streak7')) newBadges.push('streak7');
  if (newStreak >= 30 && !newBadges.includes('streak30')) newBadges.push('streak30');
  if (newStreak >= 100 && !newBadges.includes('streak100')) newBadges.push('streak100');

  const weekStart = getWeekStart();
  const storedWeekStart = profile.weeklyReset;

  const updates = {
    lastStudyDate: today,
    currentStreak: newStreak,
    longestStreak: Math.max(newStreak, profile.longestStreak || 0),
    badges: newBadges,
    totalHours: increment(sessionDuration),
  };

  if (storedWeekStart !== weekStart) {
    updates.weeklyHours = sessionDuration;
    updates.weeklyReset = weekStart;
  } else {
    updates.weeklyHours = increment(sessionDuration);
  }

  await updateDoc(userRef, updates);
}
