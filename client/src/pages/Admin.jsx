import { useEffect, useState } from 'react';
import { api, STATUS_LABELS } from '../api.js';

const ROLES = { participant: 'Участник', organizer: 'Организатор', admin: 'Админ' };

export default function Admin() {
  const [tab, setTab] = useState('regs');
  const [users, setUsers] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [cats, setCats] = useState([]);
  const [regs, setRegs] = useState([]);
  const [newCat, setNewCat] = useState('');
  const [error, setError] = useState('');

  const load = () => {
    api('/admin/users').then(setUsers).catch((e) => setError(e.message));
    api('/admin/clubs').then(setClubs).catch((e) => setError(e.message));
    api('/categories').then(setCats).catch((e) => setError(e.message));
    api('/admin/registrations').then(setRegs).catch((e) => setError(e.message));
  };
  useEffect(load, []);

  const run = async (fn) => { setError(''); try { await fn(); load(); } catch (e) { setError(e.message); } };
  const addCat = (e) => { e.preventDefault(); run(async () => { await api('/admin/categories', { method: 'POST', body: { name: newCat } }); setNewCat(''); }); };
  const renameCat = (c) => { const name = prompt('Новое название', c.name); if (name) run(() => api(`/admin/categories/${c.id}`, { method: 'PUT', body: { name } })); };
  const delCat = (c) => { if (confirm(`Удалить категорию «${c.name}»?`)) run(() => api(`/admin/categories/${c.id}`, { method: 'DELETE' })); };

  return (
    <>
      <h1>Админ-панель</h1>
      <div className="tabs">
        {[['regs', 'Заявки'], ['users', 'Пользователи'], ['clubs', 'Кружки'], ['cats', 'Категории']].map(([k, label]) => (
          <button key={k} className={tab === k ? 'tab active' : 'tab'} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      {error && <p className="error">{error}</p>}

      {tab === 'regs' && (
        regs.length === 0 ? <p className="muted">Заявок пока нет.</p> : (
          <table className="table">
            <thead><tr><th>Дата</th><th>Кружок</th><th>Участник (ребёнок)</th><th>Родитель</th><th>Телефон</th><th>Комментарий</th><th>Статус</th><th></th></tr></thead>
            <tbody>
              {regs.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.created_at).toLocaleDateString('ru-RU')}</td>
                  <td>{r.club_title}<br /><span className="muted">{r.organizer_name}</span></td>
                  <td><b>{r.participant_name}</b> ({r.participant_birth_year})</td>
                  <td>{r.parent_name}<br /><span className="muted">{r.parent_email}</span></td>
                  <td>{r.phone}</td>
                  <td>{r.comment || '—'}</td>
                  <td><span className={`status ${r.status}`}>{STATUS_LABELS[r.status]}</span></td>
                  <td className="actions">
                    {r.status === 'pending' && (
                      <>
                        <button className="btn btn-small" onClick={() => run(() => api(`/admin/registrations/${r.id}`, { method: 'PATCH', body: { status: 'confirmed' } }))}>Подтвердить</button>
                        <button className="btn btn-small btn-danger" onClick={() => run(() => api(`/admin/registrations/${r.id}`, { method: 'PATCH', body: { status: 'rejected' } }))}>Отклонить</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}

      {tab === 'users' && (
        <table className="table">
          <thead><tr><th>ФИО</th><th>Email</th><th>Роль</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name}</td><td>{u.email}</td><td>{ROLES[u.role]}</td>
                <td>{u.is_blocked ? <span className="bad">Заблокирован</span> : <span className="ok">Активен</span>}</td>
                <td>{u.role !== 'admin' && <button className="btn btn-small btn-light" onClick={() => run(() => api(`/admin/users/${u.id}/block`, { method: 'PATCH' }))}>{u.is_blocked ? 'Разблокировать' : 'Заблокировать'}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'clubs' && (
        <table className="table">
          <thead><tr><th>Название</th><th>Категория</th><th>Организатор</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {clubs.map((c) => (
              <tr key={c.id}>
                <td>{c.title}</td><td>{c.category_name}</td><td>{c.organizer_name}</td>
                <td>{c.is_active ? <span className="ok">Виден</span> : <span className="muted">Скрыт</span>}</td>
                <td><button className="btn btn-small btn-light" onClick={() => run(() => api(`/admin/clubs/${c.id}/hide`, { method: 'PATCH' }))}>{c.is_active ? 'Скрыть' : 'Показать'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'cats' && (
        <>
          <form onSubmit={addCat} className="search-row">
            <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Новая категория" required />
            <button className="btn">Добавить</button>
          </form>
          <table className="table">
            <thead><tr><th>Название</th><th></th></tr></thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td className="actions">
                    <button className="btn btn-small btn-light" onClick={() => renameCat(c)}>Переименовать</button>
                    <button className="btn btn-small btn-danger" onClick={() => delCat(c)}>Удалить</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </>
  );
}
