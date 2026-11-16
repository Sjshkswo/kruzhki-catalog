import { Link } from 'react-router-dom';
import { formatPrice, categoryStyle, bannerBg } from '../api.js';

export default function ClubCard({ club }) {
  const cat = categoryStyle(club.category_name);
  const filled = Math.max(0, Math.min(100, ((club.capacity - club.free_seats) / club.capacity) * 100));
  const free = Number(club.price) === 0;

  return (
    <Link to={`/clubs/${club.id}`} className="club-card">
      <div className="club-banner" style={bannerBg(club.category_name)}>
        <span className="club-emoji">{cat.emoji}</span>
        <span className="club-cat">{club.category_name}</span>
        {free && <span className="free-badge">Бесплатно</span>}
      </div>
      <div className="club-body">
        <h3>{club.title}</h3>
        <p className="muted">👶 {club.age_min}–{club.age_max} лет</p>
        <p className="muted">📍 {club.address || 'Адрес уточняется'}</p>
        <div className="seats">
          <div className="seats-bar"><div style={{ width: `${filled}%`, background: club.free_seats > 0 ? cat.from : '#ef4444' }} /></div>
          <span className={club.free_seats > 0 ? 'seats-ok' : 'bad'}>
            {club.free_seats > 0 ? `Свободно мест: ${club.free_seats}` : 'Мест нет'}
          </span>
        </div>
        <div className="card-footer">
          <strong className="price">{formatPrice(club.price)}</strong>
          <span className="more">Подробнее →</span>
        </div>
      </div>
    </Link>
  );
}
