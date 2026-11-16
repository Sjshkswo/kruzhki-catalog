import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="center">
      <h1>404</h1>
      <p>Такой страницы нет.</p>
      <Link to="/" className="btn">На главную</Link>
    </div>
  );
}
