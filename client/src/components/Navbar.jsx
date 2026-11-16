import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const out = () => { logout(); navigate('/'); };

  return (
    <header className="navbar">
      <div className="container nav-inner">
        <Link to="/" className="logo">🎯 <span>Кружки</span></Link>
        <nav>
          <NavLink to="/clubs">Каталог</NavLink>
          {user?.role === 'participant' && <NavLink to="/my-registrations">Мои заявки</NavLink>}
          {user?.role === 'organizer' && (
            <>
              <NavLink to="/organizer/clubs">Мои кружки</NavLink>
              <NavLink to="/organizer/registrations">Заявки</NavLink>
            </>
          )}
          {user?.role === 'admin' && <NavLink to="/admin">Админ-панель</NavLink>}
          {user ? (
            <>
              <NavLink to="/profile">{user.full_name.split(' ')[0]}</NavLink>
              <button className="link-btn" onClick={out}>Выйти</button>
            </>
          ) : (
            <>
              <NavLink to="/login">Войти</NavLink>
              <NavLink to="/register" className="btn btn-small">Регистрация</NavLink>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
