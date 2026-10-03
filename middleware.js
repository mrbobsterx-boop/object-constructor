// Пароль на весь сайт (HTTP Basic Auth). Логин и пароль — переменные окружения проекта Vercel
// SITE_USER и SITE_PASSWORD (Settings → Environment Variables); после их смены нужен редеплой.
// Без SITE_PASSWORD сайт закрыт полностью, а не открыт — чтобы забытая настройка не раскрыла всё.
export default function middleware(request) {
  const user = process.env.SITE_USER || 'admin';
  const password = process.env.SITE_PASSWORD;
  const header = request.headers.get('authorization') || '';
  if (password && header.startsWith('Basic ')) {
    let decoded = '';
    try { decoded = atob(header.slice(6)); } catch (e) { decoded = ''; }
    const i = decoded.indexOf(':');
    if (i >= 0 && decoded.slice(0, i) === user && decoded.slice(i + 1) === password) return; // пропускаем дальше
  }
  return new Response('Нужен пароль', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Game editors", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
