import { useEffect, useState } from 'react';
import { api, STATUS_LABELS, MOD_LABELS, ROLE_LABELS } from '../api.js';

export default function Admin() {
  const [tab, setTab] = useState('regs');
  const [users, setUsers] = useState([]);
  const [clubs, setClubs] = useState([]);
  const [cats, setCats] = useState([]);
  const [regs, setRegs] = useState([]);
  const [apps, setApps] = useState([]);
  const [newCat, setNewCat] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const load = () => {
    const f = (path, set) => api(path).then(set).catch((e) => setError(e.message));
    f('/admin/users', setUsers); f('/admin/clubs', setClubs); f('/categories', setCats);
    f('/admin/registrations', setRegs); f('/admin/organizer-applications', setApps);
  };
  useEffect(load, []);

  const run = async (fn) => { setError(''); setInfo(''); try { const r = await fn(); if (r && r.info) setInfo(r.info); load(); } catch (e) { setError(e.message); } };
  // действие с обязательной причиной (отказ, блокировка)
  const withReason = (question, fn) => { const reason = prompt(question); if (reason && reason.trim().length >= 3) run(() => fn(reason.trim())); else if (reason !== null) setError('Причина обязательна (не короче 3 символов)'); };

  const addCat = (e) => { e.preventDefault(); run(async () => { await api('/admin/categories', { method: 'POST', body: { name: newCat } }); setNewCat(''); }); };
  const renameCat = (c) => { const name = prompt('Новое название', c.name); if (name) run(() => api(`/admin/categories/${c.id}`, { method: 'PUT', body: { name } })); };
  const delCat = (c) => { if (confirm(`Удалить категорию «${c.name}»?`)) run(() => api(`/admin/categories/${c.id}`, { method: 'DELETE' })); };
  const setReg = (id, status) => run(() => api(`/admin/registrations/${id}`, { method: 'PATCH', body: { status } }));
  const moderate = (id, status, comment) => run(() => api(`/admin/clubs/${id}/moderation`, { method: 'PATCH', body: { status, comment } }));
  const decideApp = (id, status, comment) => run(() => api(`/admin/organizer-applications/${id}`, { method: 'PATCH', body: { status, comment } }));
  const toggleBlock = (u) => run(async () => {
    const r = await api(`/admin/users/${u.id}/block`, { method: 'PATCH' });
    return { info: r.cancelled_registrations ? `Пользователь заблокирован. Отменено активных заявок: ${r.cancelled_registrations}` : '' };
  });

  const pendingApps = apps.filter((a) => a.status === 'pending').length;
  const pendingClubs = clubs.filter((c) => c.moderation_status === 'pending_review').length;
  const tabs = [['regs', 'Заявки'], ['orgs', `Организаторы${pendingApps ? ` (${pendingApps})` : ''}`], ['clubs', `Кружки${pendingClubs ? ` (${pendingClubs})` : ''}`], ['users', 'Пользователи'], ['cats', 'Категории']];

  return (
    <>
      <h1>Админ-панель</h1>
      <div className="tabs">
        {tabs.map(([k, label]) => <button key={k} className={tab === k ? 'tab active' : 'tab'} onClick={() => setTab(k)}>{label}</button>)}
      </div>
      {error && <p className="error">{error}</p>}
      {info && <p className="ok">{info}</p>}

      {tab === 'regs' && (regs.length === 0 ? <p className="muted">Заявок пока нет.</p> : (
        <table className="table">
          <thead><tr><th>Дата</th><th>Кружок</th><th>Участник (ребёнок)</th><th>Родитель</th><th>Телефон</th><th>Комментарий</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {regs.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.created_at).toLocaleDateString('ru-RU')}</td>
                <td>{r.club_title}<br /><span className="muted">{r.organizer_name}</span></td>
                <td><b>{r.participant_name}</b> ({r.participant_birth_year})</td>
                <td>{r.parent_name}<br /><span className="muted">{r.parent_email}</span></td>
                <td>{r.phone}</td><td>{r.comment || '—'}</td>
                <td><span className={`status ${r.status}`}>{STATUS_LABELS[r.status] || r.status}</span></td>
                <td className="actions">
                  {r.status === 'pending' && (<>
                    <button className="btn btn-small" onClick={() => setReg(r.id, 'confirmed')}>Подтвердить</button>
                    <button className="btn btn-small btn-danger" onClick={() => setReg(r.id, 'rejected')}>Отклонить</button>
                  </>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}

      {tab === 'orgs' && (apps.length === 0 ? <p className="muted">Заявок на роль организатора пока нет.</p> : (
        <table className="table">
          <thead><tr><th>Дата</th><th>Организация</th><th>БИН/ИИН</th><th>Контакты</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id}>
                <td>{new Date(a.created_at).toLocaleDateString('ru-RU')}</td>
                <td><b>{a.org_name}</b><br /><span className="muted">{a.full_name} · {a.email}</span></td>
                <td>{a.bin}</td>
                <td>{a.phone}<br />{a.social_url ? <a href={a.social_url} target="_blank" rel="noopener noreferrer">{a.social_url}</a> : <span className="muted">—</span>}</td>
                <td><span className={`status ${a.status === 'approved' ? 'confirmed' : a.status === 'rejected' ? 'rejected' : 'pending'}`}>{{ pending: 'Ожидает', approved: 'Одобрена', rejected: 'Отклонена' }[a.status]}</span>
                  {a.admin_comment && <div className="muted" style={{ fontSize: 13 }}>{a.admin_comment}</div>}</td>
                <td className="actions">
                  {a.status === 'pending' && (<>
                    <button className="btn btn-small" onClick={() => decideApp(a.id, 'approved')}>Одобрить</button>
                    <button className="btn btn-small btn-danger" onClick={() => withReason('Причина отказа:', (c) => api(`/admin/organizer-applications/${a.id}`, { method: 'PATCH', body: { status: 'rejected', comment: c } }))}>Отклонить</button>
                  </>)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ))}

      {tab === 'clubs' && (
        <table className="table">
          <thead><tr><th>Название</th><th>Категория</th><th>Организатор</th><th>Модерация</th><th>Набор</th><th></th></tr></thead>
          <tbody>
            {clubs.map((c) => (
              <tr key={c.id}>
                <td>{c.title}</td><td>{c.category_name}</td>
                <td>{c.organizer_name}{c.organizer_blocked && <span className="bad"> (заблокирован)</span>}</td>
                <td><span className={`status ${c.moderation_status === 'approved' ? 'confirmed' : c.moderation_status === 'pending_review' ? 'pending' : 'rejected'}`}>{MOD_LABELS[c.moderation_status]}</span>
                  {c.moderation_comment && <div className="muted" style={{ fontSize: 13 }}>{c.moderation_comment}</div>}</td>
                <td>{c.is_active ? <span className="ok">Открыт</span> : <span className="muted">Закрыт</span>}</td>
                <td className="actions">
                  {c.moderation_status !== 'approved' && <button className="btn btn-small" onClick={() => moderate(c.id, 'approved')}>Одобрить</button>}
                  {c.moderation_status === 'pending_review' && <button className="btn btn-small btn-light" onClick={() => withReason('Причина отказа:', (r) => api(`/admin/clubs/${c.id}/moderation`, { method: 'PATCH', body: { status: 'rejected', comment: r } }))}>Отклонить</button>}
                  {c.moderation_status !== 'blocked' && <button className="btn btn-small btn-danger" onClick={() => withReason('Причина блокировки:', (r) => api(`/admin/clubs/${c.id}/moderation`, { method: 'PATCH', body: { status: 'blocked', comment: r } }))}>Заблокировать</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'users' && (
        <table className="table">
          <thead><tr><th>ФИО</th><th>Email</th><th>Роль</th><th>Статус</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.full_name}</td><td>{u.email}</td><td>{ROLE_LABELS[u.role]}</td>
                <td>{u.is_blocked ? <span className="bad">Заблокирован</span> : <span className="ok">Активен</span>}</td>
                <td>{u.role !== 'admin' && <button className="btn btn-small btn-light" onClick={() => toggleBlock(u)}>{u.is_blocked ? 'Разблокировать' : 'Заблокировать'}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {tab === 'cats' && (<>
        <form onSubmit={addCat} className="search-row">
          <input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="Новая категория" required />
          <button className="btn">Добавить</button>
        </form>
        <table className="table">
          <thead><tr><th>Название</th><th></th></tr></thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id}><td>{c.name}</td>
                <td className="actions">
                  <button className="btn btn-small btn-light" onClick={() => renameCat(c)}>Переименовать</button>
                  <button className="btn btn-small btn-danger" onClick={() => delCat(c)}>Удалить</button>
                </td></tr>
            ))}
          </tbody>
        </table>
      </>)}
    </>
  );
}
