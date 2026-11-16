import { useEffect, useState } from 'react';
import { api, STATUS_LABELS } from '../api.js';

export default function OrganizerRegistrations() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  const load = () => api('/organizer/registrations').then(setItems).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const setStatus = async (id, status) => {
    try { await api(`/organizer/registrations/${id}`, { method: 'PATCH', body: { status } }); load(); }
    catch (e) { setError(e.message); }
  };

  if (!items) return <p>{error || 'Загрузка…'}</p>;
  return (
    <>
      <h1>Заявки на мои кружки</h1>
      {error && <p className="error">{error}</p>}
      {items.length === 0 ? <p className="muted">Заявок пока нет.</p> : (
        <table className="table">
          <thead><tr><th>Кружок</th><th>Участник (ребёнок)</th><th>Родитель</th><th>Телефон</th><th>Комментарий</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {items.map((r) => (
              <tr key={r.id}>
                <td>{r.club_title}</td>
                <td>{r.participant_name} ({r.participant_birth_year})</td>
                <td>{r.parent_name}<br /><span className="muted">{r.user_email}</span></td>
                <td>{r.phone}</td>
                <td>{r.comment || '—'}</td>
                <td><span className={`status ${r.status}`}>{STATUS_LABELS[r.status]}</span></td>
                <td className="actions">
                  {r.status === 'pending' && (
                    <>
                      <button className="btn btn-small" onClick={() => setStatus(r.id, 'confirmed')}>Подтвердить</button>
                      <button className="btn btn-small btn-danger" onClick={() => setStatus(r.id, 'rejected')}>Отклонить</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
