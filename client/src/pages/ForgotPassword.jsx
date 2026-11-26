import { Link } from 'react-router-dom';
import { waLink } from '../config.js';

export default function ForgotPassword() {
  return (
    <div className="card narrow">
      <h1>Восстановление пароля</h1>
      <p className="muted">
        Восстановление через почту отключено. Напишите нам в WhatsApp, чтобы подтвердить владение аккаунтом и восстановить доступ.
      </p>
      <a className="btn btn-wa" href={waLink('Здравствуйте! Мне нужно восстановить доступ к аккаунту в каталоге кружков.')} target="_blank" rel="noopener noreferrer">
        Написать в WhatsApp
      </a>
      <p className="muted" style={{ marginTop: '16px', textAlign: 'center' }}>
        Вспомнили пароль? <Link to="/login">Войти</Link>
      </p>
    </div>
  );
}
