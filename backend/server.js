const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(express.json());

// Firebase init — still used for Firestore storage only (no login/auth involved).
// On a host like Render, set FIREBASE_SERVICE_ACCOUNT to the full JSON (as one line).
// Locally, it falls back to backend/serviceAccountKey.json (never commit that file).
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  serviceAccount = require('./serviceAccountKey.json');
}
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// Public app: every visitor shares the same habit list, no login wall.
const PUBLIC_UID = 'public';

// ── GET /habits ── list all habits
app.get('/habits', async (req, res) => {
  try {
    const snap = await db.collection('habits')
      .where('uid', '==', PUBLIC_UID)
      .orderBy('createdAt', 'asc')
      .get();
    const habits = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(habits);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /habits ── create habit
app.post('/habits', async (req, res) => {
  const { name, emoji } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const ref = await db.collection('habits').add({
    uid: PUBLIC_UID,
    name,
    emoji: emoji || '✅',
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  res.json({ id: ref.id, name, emoji });
});

// ── DELETE /habits/:id ── delete habit + all its checks
app.delete('/habits/:id', async (req, res) => {
  const habitRef = db.collection('habits').doc(req.params.id);
  const habit = await habitRef.get();
  if (!habit.exists) return res.status(404).json({ error: 'Not found' });
  const checks = await db.collection('checks')
    .where('habitId', '==', req.params.id).get();
  const batch = db.batch();
  checks.docs.forEach(d => batch.delete(d.ref));
  batch.delete(habitRef);
  await batch.commit();
  res.json({ success: true });
});

// ── GET /checks?date=YYYY-MM-DD ── get checks for a date
app.get('/checks', async (req, res) => {
  const { date } = req.query;
  if (!date) return res.status(400).json({ error: 'date required' });
  const snap = await db.collection('checks')
    .where('uid', '==', PUBLIC_UID)
    .where('date', '==', date)
    .get();
  const checks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  res.json(checks);
});

// ── POST /checks/toggle ── toggle a check on/off
app.post('/checks/toggle', async (req, res) => {
  const { habitId, date } = req.body;
  if (!habitId || !date) return res.status(400).json({ error: 'habitId + date required' });

  const existing = await db.collection('checks')
    .where('uid', '==', PUBLIC_UID)
    .where('habitId', '==', habitId)
    .where('date', '==', date)
    .get();

  if (!existing.empty) {
    await existing.docs[0].ref.delete();
    return res.json({ done: false });
  }
  await db.collection('checks').add({
    uid: PUBLIC_UID, habitId, date,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });
  res.json({ done: true });
});

// ── GET /streak/:habitId ── calculate streak
app.get('/streak/:habitId', async (req, res) => {
  const snap = await db.collection('checks')
    .where('uid', '==', PUBLIC_UID)
    .where('habitId', '==', req.params.habitId)
    .orderBy('date', 'desc')
    .get();

  const doneDates = new Set(snap.docs.map(d => d.data().date));
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (doneDates.has(key)) streak++;
    else if (i > 0) break;
  }
  res.json({ streak });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT} — public, no login required`));
