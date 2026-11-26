import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatPrice, MOD_LABELS } from '../api.js';

export default function OrganizerClubs() {
  const [clubs, setClubs] = useState(null);
  const [error, setError] = useState('');

  const load = () => api('/organizer/clubs').then(setClubs).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const hide = async (id) => {
    if (!confirm('Закрыть набор в этот кружок?')) return;
    try { await api(`/organizer/clubs/${id}`, { method: 'DELETE' }); load(); } catch (e) { setError(e.message); }
  };

  if (!clubs) return <p>{error || 'Загрузка…'}</p>;
  return (
    <>
      <div className="row-between">
        <h1>Мои кружки</h1>
        <Link to="/organizer/clubs/new" className="btn">+ Добавить кружок</Link>
      </div>
      {error && <p className="error">{error}</p>}
      {clubs.length === 0 ? <p className="muted">У вас пока нет кружков.</p> : (
        <table className="table">
          <thead><tr><th>Название</th><th>Категория</th><th>Цена</th><th>Места</th><th>Модерация</th><th>Набор</th><th></th></tr></thead>
          <tbody>
            {clubs.map((c) => (
              <tr key={c.id}>
                <td>{c.title}</td>
                <td>{c.category_name}</td>
                <td>{formatPrice(c.price)}</td>
                <td>{c.free_seats} / {c.capacity}</td>
                <td>
                  <span className={`status ${c.moderation_status === 'approved' ? 'confirmed' : c.moderation_status === 'pending_review' ? 'pending' : 'rejected'}`}>{MOD_LABELS[c.moderation_status]}</span>
                  {c.moderation_comment && <div className="muted" style={{ fontSize: 13 }}>Причина: {c.moderation_comment}</div>}
                </td>
                <td>{c.is_active ? <span className="ok">Открыт</span> : <span className="muted">Закрыт</span>}</td>
                <td className="actions">
                  <Link to={`/organizer/clubs/${c.id}/edit`} className="btn btn-small btn-light">Изменить</Link>
                  {c.is_active && <button className="btn btn-small btn-danger" onClick={() => hide(c.id)}>Закрыть набор</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
