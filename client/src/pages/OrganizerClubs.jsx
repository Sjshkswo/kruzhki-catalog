import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatPrice } from '../api.js';

export default function OrganizerClubs() {
  const [clubs, setClubs] = useState(null);
  const [error, setError] = useState('');

  const load = () => api('/organizer/clubs').then(setClubs).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const hide = async (id) => {
    if (!confirm('Скрыть кружок из каталога?')) return;
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
          <thead><tr><th>Название</th><th>Категория</th><th>Цена</th><th>Места</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {clubs.map((c) => (
              <tr key={c.id}>
                <td>{c.title}</td>
                <td>{c.category_name}</td>
                <td>{formatPrice(c.price)}</td>
                <td>{c.free_seats} / {c.capacity}</td>
                <td>{c.is_active ? <span className="ok">Виден</span> : <span className="muted">Скрыт</span>}</td>
                <td className="actions">
                  <Link to={`/organizer/clubs/${c.id}/edit`} className="btn btn-small btn-light">Изменить</Link>
                  {c.is_active && <button className="btn btn-small btn-danger" onClick={() => hide(c.id)}>Скрыть</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
