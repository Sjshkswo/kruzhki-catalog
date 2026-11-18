import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext.jsx';
import Navbar from './components/Navbar.jsx';
import WhatsAppButton from './components/WhatsAppButton.jsx';
import { CONTACT_EMAIL, waLink } from './config.js';
import Home from './pages/Home.jsx';
import Clubs from './pages/Clubs.jsx';
import ClubDetail from './pages/ClubDetail.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import Profile from './pages/Profile.jsx';
import MyRegistrations from './pages/MyRegistrations.jsx';
import OrganizerClubs from './pages/OrganizerClubs.jsx';
import ClubForm from './pages/ClubForm.jsx';
import OrganizerRegistrations from './pages/OrganizerRegistrations.jsx';
import Admin from './pages/Admin.jsx';
import NotFound from './pages/NotFound.jsx';

// Пускает на страницу только авторизованных (и, если указано, только нужные роли)
function Protected({ roles, children }) {
  const { user, loading } = useAuth();
  if (loading) return <p className="container">Загрузка…</p>;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <>
      <Navbar />
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/clubs" element={<Clubs />} />
          <Route path="/clubs/:id" element={<ClubDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<Protected><Profile /></Protected>} />
          <Route path="/my-registrations" element={<Protected roles={['parent', 'organizer', 'admin']}><MyRegistrations /></Protected>} />
          <Route path="/organizer/clubs" element={<Protected roles={['organizer']}><OrganizerClubs /></Protected>} />
          <Route path="/organizer/clubs/new" element={<Protected roles={['organizer']}><ClubForm /></Protected>} />
          <Route path="/organizer/clubs/:id/edit" element={<Protected roles={['organizer']}><ClubForm /></Protected>} />
          <Route path="/organizer/registrations" element={<Protected roles={['organizer']}><OrganizerRegistrations /></Protected>} />
          <Route path="/admin" element={<Protected roles={['admin']}><Admin /></Protected>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      <footer className="footer">
        <div className="footer-contacts">
          {CONTACT_EMAIL && <a href={`mailto:${CONTACT_EMAIL}`}>✉️ {CONTACT_EMAIL}</a>}
          <a href={waLink()} target="_blank" rel="noopener noreferrer">💬 Написать в WhatsApp</a>
        </div>
        Каталог кружков и секций · дипломный проект
      </footer>
      <WhatsAppButton />
    </>
  );
}
