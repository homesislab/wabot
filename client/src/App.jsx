import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Sessions from './pages/Sessions';
import Rules from './pages/Rules';
import Scheduler from './pages/Scheduler';
import SendMessage from './pages/SendMessage';
import Groups from './pages/Groups';
import Contacts from './pages/Contacts';
import History from './pages/History';
import Login from './pages/Login';
import Users from './pages/Users';
import AiTools from './pages/AiTools';
import Gallery from './pages/Gallery';
import Logs from './pages/Logs';
import Broadcast from './pages/Broadcast';
import LandingPage from './pages/LandingPage';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Credentials from './pages/Credentials';
import Games from './pages/Games';
import Notes from './pages/Notes';
import TelegramBots from './pages/TelegramBots';
import Documentation from './pages/Documentation';
import MiniApps from './pages/MiniApps';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};



function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/app" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="sessions" element={<Sessions />} />
            <Route path="groups" element={<Groups />} />
            <Route path="rules" element={<Rules />} />
            <Route path="scheduler" element={<Scheduler />} />
            <Route path="send" element={<SendMessage />} />
            <Route path="contacts" element={<Contacts />} />
            <Route path="history" element={<History />} />
            <Route path="users" element={<Users />} />
            <Route path="gallery" element={<Gallery />} />
            <Route path="logs" element={<Logs />} />
            <Route path="ai-tools" element={<AiTools />} />
            <Route path="credentials" element={<Credentials />} />
            <Route path="broadcast" element={<Broadcast />} />
            <Route path="profile" element={<Profile />} />
            <Route path="games" element={<Games />} />
            <Route path="notes" element={<Notes />} />
            <Route path="telegram-bots" element={<TelegramBots />} />
            <Route path="docs" element={<Documentation />} />
            <Route path="mini-apps" element={<MiniApps />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
