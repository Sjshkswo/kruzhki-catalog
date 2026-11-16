import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, STATUS_LABELS } from '../api.js';

export default function MyRegistrations() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  const load = () => api('/registrations/my').then(setItems).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const cancel = async (id) => {
    if (!confirm('Отменить заявку?')) return;
    try { await api(`/registrations/${id}/cancel`, { method: 'PATCH' }); load(); }
    catch (e) { setError(e.message); }
  };

  if (!items) return <p>{error || 'Загрузка…'}</p>;
  return (
    <>
      <h1>Мои заявки</h1>
      {error && <p className="error">{error}</p>}
      {items.length === 0 ? <p className="muted">Заявок пока нет. <Link to="/clubs">Перейти в каталог</Link></p> : (
        <table className="table">
          <thead><tr><th>Кружок</th><th>Участник</th><th>Дата</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td><Link to={`/clubs/${r.club_id}`}>{r.club_title}</Link></td>
                <td>{r.participant_name} ({r.participant_birth_year})</td>
                <td>{new Date(r.created_at).toLocaleDateString('ru-RU')}</td>
                <td><span className={`status ${r.status}`}>{STATUS_LABELS[r.status]}</span></td>
                <td>{['pending', 'confirmed'].includes(r.status) && <button className="btn btn-small btn-light" onClick={() => cancel(r.id)}>Отменить</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
