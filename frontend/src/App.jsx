import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import DetailView from './components/DetailView';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const handleStorage = () => setToken(localStorage.getItem('token'));
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const handleLogin = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Routes>
        <Route
          path="/"
          element={
            token
              ? <Navigate to="/dashboard" replace />
              : <Login onLogin={handleLogin} />
          }
        />
        <Route
          path="/dashboard"
          element={
            token
              ? <Dashboard onLogout={handleLogout} />
              : <Navigate to="/" replace />
          }
        />
        <Route
          path="/details"
          element={
            token
              ? <DetailView />
              : <Navigate to="/" replace />
          }
        />
      </Routes>
    </div>
  );
}

export default App;

