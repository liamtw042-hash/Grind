import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import AuthPage from './components/auth/AuthPage';
import Layout from './components/layout/Layout';
import Home from './pages/Home';
import Timer from './pages/Timer';
import Leaderboard from './pages/Leaderboard';
import Battles from './pages/Battles';
import Profile from './pages/Profile';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/auth" replace />;
}

export default function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/auth" element={user ? <Navigate to="/" replace /> : <AuthPage />} />
      <Route path="/" element={<PrivateRoute><Layout><Home /></Layout></PrivateRoute>} />
      <Route path="/timer" element={<PrivateRoute><Layout><Timer /></Layout></PrivateRoute>} />
      <Route path="/leaderboard" element={<PrivateRoute><Layout><Leaderboard /></Layout></PrivateRoute>} />
      <Route path="/battles" element={<PrivateRoute><Layout><Battles /></Layout></PrivateRoute>} />
      <Route path="/profile" element={<PrivateRoute><Layout><Profile /></Layout></PrivateRoute>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
