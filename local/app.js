(() => {
  'use strict';

  const STORAGE_KEY = 'bibliotech-local-v1';
  const SEED_BOOKS = [
    {
      id: 'book-desolacion',
      title: 'Desolación',
      author: 'Gabriela Mistral',
      year: 1922,
      description: 'Poemario fundamental de Gabriela Mistral.',
      image: '',
      available: 3,
      featured: true,
      published: true,
    },
    {
      id: 'book-sub-terra',
      title: 'Sub terra',
      author: 'Baldomero Lillo',
      year: 1904,
      description: 'Relatos sobre la vida minera en Chile.',
      image: '',
      available: 2,
      featured: true,
      published: true,
    },
    {
      id: 'book-papelucho',
      title: 'Papelucho',
      author: 'Marcela Paz',
      year: 1947,
      description: 'Las aventuras narradas en el diario de Papelucho.',
      image: '',
      available: 4,
      featured: true,
      published: true,
    },
    {
      id: 'book-ciudad',
      title: 'La ciudad y los perros',
      author: 'Mario Vargas Llosa',
      year: 1963,
      description: 'Novela ambientada en un colegio militar de Lima.',
      image: '',
      available: 2,
      featured: false,
      published: true,
    },
  ];

  let state;
  let noticeTimer;
  const app = document.querySelector('#app');
  const notice = document.querySelector('#notice');
  const navUser = document.querySelector('#nav-user');

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[character]);
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      throw new Error(`No se pudieron guardar los datos del navegador: ${error.message}`);
    }
  }

  function readState() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored);
    if (
      !parsed
      || !Array.isArray(parsed.books)
      || !Array.isArray(parsed.users)
      || !Array.isArray(parsed.loans)
    ) {
      throw new Error('Los datos locales de la biblioteca no tienen un formato válido.');
    }
    return parsed;
  }

  function toBase64(bytes) {
    return btoa(String.fromCharCode(...new Uint8Array(bytes)));
  }

  async function derivePassword(password, salt) {
    if (!window.crypto?.subtle) {
      throw new Error('Este navegador no permite proteger contraseñas en modo local. Abre la app en una versión reciente de Chrome o Edge.');
    }
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 120000,
        hash: 'SHA-256',
      },
      key,
      256,
    );
    return toBase64(bits);
  }

  async function createPasswordRecord(password) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    return {
      salt: toBase64(salt),
      hash: await derivePassword(password, salt),
    };
  }

  async function seedState() {
    const password = await createPasswordRecord('biblioteca123');
    state = {
      books: SEED_BOOKS,
      users: [{
        id: 'user-admin',
        username: 'admin',
        displayName: 'Bibliotecario',
        passwordSalt: password.salt,
        passwordHash: password.hash,
        role: 'admin',
        createdAt: new Date().toISOString(),
      }],
      loans: [],
      sessionUserId: null,
    };
    saveState();
  }

  function currentUser() {
    return state.users.find((user) => user.id === state.sessionUserId) || null;
  }

  function isAdmin() {
    return currentUser()?.role === 'admin';
  }

  function showNotice(message, type = 'success') {
    clearTimeout(noticeTimer);
    notice.textContent = message;
    notice.className = `notice ${type}`;
    notice.hidden = false;
    noticeTimer = setTimeout(() => {
      notice.hidden = true;
    }, 6000);
  }

  function setView(title, content) {
    document.title = `${title} · BiblioTech local`;
    app.innerHTML = content;
    updateNavigation();
    window.scrollTo(0, 0);
  }

  function updateNavigation() {
    const user = currentUser();
    if (!user) {
      navUser.innerHTML = `
        <div class="nav-user">
          <a href="#login">Ingresar</a>
          <a href="#registro">Crear cuenta</a>
        </div>`;
      return;
    }
    navUser.innerHTML = `
      <div class="nav-user">
        <span>${escapeHtml(user.displayName || user.username)}</span>
        <a href="#perfil">Mi perfil</a>
        ${user.role === 'admin' ? '<a href="#admin">Administración</a>' : ''}
        <button type="button" data-action="logout">Salir</button>
      </div>`;
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(date);
  }

  function isOverdue(loan) {
    return !loan.returnedAt && Date.now() > Date.parse(loan.dueAt);
  }

  function hasOverdueLoan(userId) {
    return state.loans.some((loan) => loan.userId === userId && isOverdue(loan));
  }

  function getBook(bookId) {
    return state.books.find((book) => book.id === bookId);
  }

  function coverMarkup(book, extraClass = '') {
    if (book.image) {
      return `<img class="${escapeHtml(extraClass)}" src="${escapeHtml(book.image)}" alt="Portada de ${escapeHtml(book.title)}">`;
    }
    return `<div class="portada-vacia ${escapeHtml(extraClass)}" aria-label="Sin portada disponible"><span>${escapeHtml(book.title)}</span></div>`;
  }

  function bookCard(book) {
    return `
      <article class="tarjeta-libro">
        <a href="#libro/${encodeURIComponent(book.id)}" class="portada-link">
          ${coverMarkup(book)}
        </a>
        <h3>${escapeHtml(book.title)}</h3>
        <p class="autor">${escapeHtml(book.author)}</p>
        <a href="#libro/${encodeURIComponent(book.id)}" class="btn-ver">Ver libro</a>
      </article>`;
  }

  function renderHome() {
    const featured = state.books.filter((book) => book.published && book.featured);
    setView('Inicio', `
      <section class="hero">
        <img src="https://images.unsplash.com/photo-1564399579883-451a5d44ec08?w=1100"
             alt="Biblioteca" class="hero-img">
        <div class="hero-copy">
          <h1>Un libro, nuevos mundos.</h1>
          <p class="hero-texto">Explora el catálogo local y administra préstamos desde este navegador.</p>
          <a href="#catalogo" class="hero-link">Explorar catálogo</a>
        </div>
      </section>
      <div class="seccion-titulo">
        <h2>Libros destacados</h2>
        <a href="#catalogo">Ver catálogo</a>
      </div>
      <div class="grid-libros">
        ${featured.length ? featured.map(bookCard).join('') : '<p class="empty-state">Todavía no hay libros destacados publicados.</p>'}
      </div>
      <p class="local-storage-note">Esta versión guarda sus datos solamente en este navegador y dispositivo.</p>`);
  }

  function renderCatalog(query = '') {
    const normalized = query.trim().toLocaleLowerCase('es');
    const books = state.books.filter((book) => (
      book.published
      && (!normalized
        || book.title.toLocaleLowerCase('es').includes(normalized)
        || book.author.toLocaleLowerCase('es').includes(normalized))
    ));
    setView('Catálogo', `
      <section class="busqueda-panel">
        <h1>Catálogo de libros</h1>
        <form class="search-row" data-form="search">
          <input type="search" name="q" value="${escapeHtml(query)}" placeholder="Buscar por título o autor" aria-label="Buscar por título o autor">
          <button type="submit" class="button-secondary">Buscar</button>
        </form>
      </section>
      ${normalized ? `<div class="seccion-titulo resultados-titulo"><h2>Resultados para “${escapeHtml(query)}”</h2></div>` : ''}
      <div class="grid-libros">
        ${books.length ? books.map(bookCard).join('') : '<p class="empty-state">No se encontraron libros.</p>'}
      </div>`);
  }

  function renderBook(bookId) {
    const book = getBook(bookId);
    if (!book || !book.published) {
      setView('Libro no encontrado', '<p class="empty-state">Este libro no está disponible en el catálogo.</p><a href="#catalogo">Volver al catálogo</a>');
      return;
    }
    const user = currentUser();
    const overdue = user && hasOverdueLoan(user.id);
    let loanPanel;
    if (!user) {
      loanPanel = '<p><a href="#login">Ingresa</a> para solicitar un préstamo.</p>';
    } else if (overdue) {
      loanPanel = '<p class="warning-panel">Tienes un libro atrasado. Devuélvelo para poder solicitar otro préstamo.</p>';
    } else if (book.available < 1) {
      loanPanel = '<p>No quedan ejemplares disponibles.</p>';
    } else {
      loanPanel = `
        <form class="formulario" data-form="loan" data-book-id="${escapeHtml(book.id)}">
          <label for="loan-type">Tipo de préstamo</label>
          <select id="loan-type" name="type" required>
            <option value="normal">Normal (7 días, puede salir del recinto)</option>
            <option value="reserva">Reserva (2 horas, solo dentro del recinto)</option>
          </select>
          <p class="aviso-reserva">El préstamo de reserva es solo para consulta dentro de la biblioteca; el libro no puede salir del recinto.</p>
          <button type="submit">Solicitar préstamo</button>
        </form>`;
    }
    const managementLinks = isAdmin() ? `
      <div class="book-actions detail-actions">
        <a class="button-secondary" href="#editar/${encodeURIComponent(book.id)}">Editar libro</a>
        <button class="button-danger" type="button" data-action="delete-book" data-book-id="${escapeHtml(book.id)}">Eliminar libro</button>
      </div>` : '';
    setView(book.title, `
      <div class="ficha-libro">
        ${coverMarkup(book, 'portada portada-detalle')}
        <div class="info-libro book-detail-copy">
          <p><strong>Título:</strong> ${escapeHtml(book.title)}</p>
          <p><strong>Autor:</strong> ${escapeHtml(book.author)}</p>
          <p><strong>Año:</strong> ${escapeHtml(book.year)}</p>
          <p><strong>Ejemplares disponibles:</strong> ${escapeHtml(book.available)}</p>
          ${book.description ? `<p class="descripcion-libro">${escapeHtml(book.description)}</p>` : ''}
        </div>
      </div>
      <div class="caja-prestamo">
        <h3>Solicitar préstamo</h3>
        <p>Elige el tipo de préstamo para este libro.</p>
        ${loanPanel}
      </div>
      ${managementLinks}`);
  }

  function renderLogin() {
    setView('Iniciar sesión', `
      <div class="modal-login">
        <h2>Iniciar sesión</h2>
        <form class="formulario" data-form="login">
          <label for="username">Usuario</label>
          <input id="username" name="username" autocomplete="username" required>
          <label for="password">Contraseña</label>
          <input id="password" name="password" type="password" autocomplete="current-password" required>
          <button type="submit">Entrar</button>
        </form>
        <p class="link-secundario">¿No tienes cuenta? <a href="#registro">Crear una</a></p>
        <p class="local-storage-note">Cuenta inicial de administración: <strong>admin</strong> / <strong>biblioteca123</strong></p>
      </div>`);
  }

  function renderRegistration() {
    setView('Crear cuenta', `
      <div class="modal-login">
        <h2>Crear cuenta local</h2>
        <form class="formulario" data-form="register">
          <label for="display-name">Nombre</label>
          <input id="display-name" name="displayName" maxlength="100" autocomplete="name" required>
          <label for="new-username">Usuario</label>
          <input id="new-username" name="username" minlength="3" maxlength="40" autocomplete="username" required>
          <label for="new-password">Contraseña (mínimo 8 caracteres)</label>
          <input id="new-password" name="password" type="password" minlength="8" autocomplete="new-password" required>
          <button type="submit">Registrarme</button>
        </form>
        <p class="link-secundario">¿Ya tienes cuenta? <a href="#login">Inicia sesión</a></p>
      </div>`);
  }

  function requireUser() {
    if (currentUser()) return true;
    showNotice('Inicia sesión para acceder a esta sección.', 'error');
    location.hash = '#login';
    return false;
  }

  function renderProfile() {
    if (!requireUser()) return;
    const user = currentUser();
    const loans = state.loans
      .filter((loan) => loan.userId === user.id)
      .sort((first, second) => Date.parse(second.createdAt) - Date.parse(first.createdAt));
    const loanRows = loans.map((loan) => {
      const book = getBook(loan.bookId);
      const status = loan.returnedAt ? 'Devuelto' : isOverdue(loan) ? 'Atrasado' : 'En préstamo';
      const type = loan.type === 'reserva' ? 'Reserva' : 'Normal';
      return `
        <article class="fila-prestamo">
          <strong>${escapeHtml(book?.title || 'Libro eliminado')}</strong>
          <span>${type}</span>
          <span>Solicitado: ${formatDate(loan.createdAt)}</span>
          <span>Vence: ${formatDate(loan.dueAt)}</span>
          <span>${status}${loan.returnedAt ? ` · ${formatDate(loan.returnedAt)}` : ''}</span>
        </article>`;
    }).join('');
    setView('Mi perfil', `
      <div class="tarjeta-perfil">
        <div class="avatar" aria-hidden="true">♙</div>
        <div class="perfil-info">
          <p>Cuenta local · ${escapeHtml(user.username)}</p>
          <p class="perfil-nombre">${escapeHtml(user.displayName || user.username)}</p>
        </div>
      </div>
      ${hasOverdueLoan(user.id) ? '<p class="warning-panel">Tienes un préstamo atrasado. Devuélvelo para poder solicitar otro.</p>' : ''}
      <div class="seccion-titulo"><h2>Mis préstamos</h2></div>
      <div class="lista-prestamos">${loanRows || '<p>Todavía no has solicitado ningún préstamo.</p>'}</div>
      <div class="modal-login">
        <h2>Cambiar contraseña local</h2>
        <form class="formulario" data-form="password-change">
          <label for="current-password">Contraseña actual</label>
          <input id="current-password" name="currentPassword" type="password" autocomplete="current-password" required>
          <label for="updated-password">Nueva contraseña (mínimo 8 caracteres)</label>
          <input id="updated-password" name="newPassword" type="password" minlength="8" autocomplete="new-password" required>
          <button type="submit">Cambiar contraseña</button>
        </form>
      </div>
      <p class="local-storage-note">Tu cuenta y actividad solo existen en este navegador.</p>`);
  }

  function requireAdmin() {
    if (isAdmin()) return true;
    showNotice('Esta sección requiere la cuenta de administración local.', 'error');
    location.hash = currentUser() ? '#inicio' : '#login';
    return false;
  }

  function renderAdmin() {
    if (!requireAdmin()) return;
    const books = [...state.books].sort((a, b) => a.title.localeCompare(b.title, 'es'));
    const loans = [...state.loans].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
    const bookRows = books.map((book) => `
      <tr>
        <td>${escapeHtml(book.title)}</td>
        <td>${escapeHtml(book.author)}</td>
        <td>${escapeHtml(book.available)}</td>
        <td>${book.published ? 'Publicado' : 'Oculto'}</td>
        <td>
          <a class="button-secondary" href="#editar/${encodeURIComponent(book.id)}">Editar</a>
          <button class="button-danger" type="button" data-action="delete-book" data-book-id="${escapeHtml(book.id)}">Eliminar</button>
        </td>
      </tr>`).join('');
    const loanRows = loans.map((loan) => {
      const book = getBook(loan.bookId);
      const user = state.users.find((entry) => entry.id === loan.userId);
      const status = loan.returnedAt ? `Devuelto · ${formatDate(loan.returnedAt)}` : isOverdue(loan) ? 'Atrasado' : 'En préstamo';
      const returnButton = loan.returnedAt
        ? ''
        : `<button class="button-secondary" type="button" data-action="return-loan" data-loan-id="${escapeHtml(loan.id)}">Registrar devolución</button>`;
      return `
        <tr>
          <td>${escapeHtml(user?.displayName || user?.username || 'Cuenta eliminada')}</td>
          <td>${escapeHtml(book?.title || 'Libro eliminado')}</td>
          <td>${loan.type === 'reserva' ? 'Reserva' : 'Normal'}</td>
          <td>${formatDate(loan.dueAt)}</td>
          <td>${status}</td>
          <td>${returnButton}</td>
        </tr>`;
    }).join('');
    setView('Administración local', `
      <div class="section-tools">
        <h1>Administración local</h1>
        <a href="#nuevo-libro" class="button-secondary">Agregar libro</a>
      </div>
      <p class="local-storage-note">Las cuentas y los préstamos de esta página son locales a este navegador.</p>
      <div class="seccion-titulo"><h2>Libros</h2></div>
      <div class="table-wrap">
        <table class="local-table">
          <thead><tr><th>Título</th><th>Autor</th><th>Disponibles</th><th>Visibilidad</th><th>Acciones</th></tr></thead>
          <tbody>${bookRows || '<tr><td colspan="5">No hay libros.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="seccion-titulo"><h2>Préstamos</h2></div>
      <div class="table-wrap">
        <table class="local-table">
          <thead><tr><th>Usuario</th><th>Libro</th><th>Tipo</th><th>Vence</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>${loanRows || '<tr><td colspan="6">Todavía no hay préstamos.</td></tr>'}</tbody>
        </table>
      </div>`);
  }

  function renderBookForm(bookId = '') {
    if (!requireAdmin()) return;
    const book = bookId ? getBook(bookId) : null;
    if (bookId && !book) {
      showNotice('No se encontró el libro que quieres editar.', 'error');
      location.hash = '#admin';
      return;
    }
    setView(book ? 'Editar libro' : 'Agregar libro', `
      <h2>${book ? 'Editar libro' : 'Agregar libro'}</h2>
      <form class="formulario" data-form="book" data-book-id="${escapeHtml(book?.id || '')}">
        <label for="book-title">Título</label>
        <input id="book-title" name="title" maxlength="180" value="${escapeHtml(book?.title || '')}" required>
        <label for="book-author">Autor</label>
        <input id="book-author" name="author" maxlength="100" value="${escapeHtml(book?.author || '')}" required>
        <label for="book-year">Año</label>
        <input id="book-year" name="year" type="number" min="0" max="9999" value="${escapeHtml(book?.year || '')}" required>
        <label for="book-copies">Ejemplares disponibles</label>
        <input id="book-copies" name="available" type="number" min="0" value="${escapeHtml(book?.available ?? 1)}" required>
        <label for="book-image">URL de imagen (opcional)</label>
        <input id="book-image" name="image" type="url" value="${escapeHtml(book?.image || '')}">
        <label for="book-description">Descripción</label>
        <textarea id="book-description" name="description">${escapeHtml(book?.description || '')}</textarea>
        <label class="check-field"><input name="featured" type="checkbox" ${book?.featured ? 'checked' : ''}> Destacado</label>
        <label class="check-field"><input name="published" type="checkbox" ${book?.published !== false ? 'checked' : ''}> Publicado</label>
        <button type="submit">Guardar libro</button>
        <a class="button-secondary" href="#admin">Cancelar</a>
      </form>`);
  }

  function route() {
    const routeValue = decodeURIComponent(location.hash.slice(1) || 'inicio');
    if (routeValue === 'inicio') return renderHome();
    if (routeValue === 'catalogo') return renderCatalog();
    if (routeValue.startsWith('catalogo?')) {
      return renderCatalog(new URLSearchParams(routeValue.slice('catalogo?'.length)).get('q') || '');
    }
    if (routeValue.startsWith('libro/')) return renderBook(routeValue.slice('libro/'.length));
    if (routeValue === 'login') return renderLogin();
    if (routeValue === 'registro') return renderRegistration();
    if (routeValue === 'perfil') return renderProfile();
    if (routeValue === 'admin') return renderAdmin();
    if (routeValue === 'nuevo-libro') return renderBookForm();
    if (routeValue.startsWith('editar/')) return renderBookForm(routeValue.slice('editar/'.length));
    location.hash = '#inicio';
  }

  async function handleFormSubmit(form) {
    const data = new FormData(form);
    const formType = form.dataset.form;
    if (formType === 'search') {
      const query = String(data.get('q') || '').trim();
      location.hash = query ? `#catalogo?q=${encodeURIComponent(query)}` : '#catalogo';
      return;
    }
    if (formType === 'login') {
      const username = String(data.get('username') || '').trim().toLocaleLowerCase('es');
      const user = state.users.find(
        (entry) => entry.username.toLocaleLowerCase('es') === username,
      );
      if (!user) throw new Error('El usuario o la contraseña no son correctos.');
      const salt = Uint8Array.from(atob(user.passwordSalt), (character) => character.charCodeAt(0));
      const candidate = await derivePassword(String(data.get('password') || ''), salt);
      if (candidate !== user.passwordHash) {
        throw new Error('El usuario o la contraseña no son correctos.');
      }
      state.sessionUserId = user.id;
      saveState();
      showNotice(`Bienvenido, ${user.displayName || user.username}.`);
      location.hash = '#inicio';
      return;
    }
    if (formType === 'register') {
      const username = String(data.get('username') || '').trim();
      const displayName = String(data.get('displayName') || '').trim();
      const password = String(data.get('password') || '');
      if (username.length < 3) throw new Error('El usuario debe tener al menos 3 caracteres.');
      if (password.length < 8) throw new Error('La contraseña debe tener al menos 8 caracteres.');
      if (state.users.some((user) => user.username.toLocaleLowerCase('es') === username.toLocaleLowerCase('es'))) {
        throw new Error('Ese nombre de usuario ya está ocupado.');
      }
      const passwordRecord = await createPasswordRecord(password);
      const user = {
        id: makeId('user'),
        username,
        displayName,
        passwordSalt: passwordRecord.salt,
        passwordHash: passwordRecord.hash,
        role: 'reader',
        createdAt: new Date().toISOString(),
      };
      state.users.push(user);
      state.sessionUserId = user.id;
      saveState();
      showNotice('Tu cuenta local quedó creada.');
      location.hash = '#inicio';
      return;
    }
    if (formType === 'password-change') {
      const user = currentUser();
      if (!user) throw new Error('Inicia sesión para cambiar la contraseña.');
      const currentPassword = String(data.get('currentPassword') || '');
      const salt = Uint8Array.from(atob(user.passwordSalt), (character) => character.charCodeAt(0));
      const currentHash = await derivePassword(currentPassword, salt);
      if (currentHash !== user.passwordHash) throw new Error('La contraseña actual no es correcta.');
      const newPassword = String(data.get('newPassword') || '');
      if (newPassword.length < 8) throw new Error('La nueva contraseña debe tener al menos 8 caracteres.');
      const passwordRecord = await createPasswordRecord(newPassword);
      user.passwordSalt = passwordRecord.salt;
      user.passwordHash = passwordRecord.hash;
      saveState();
      showNotice('Contraseña local actualizada.');
      renderProfile();
      return;
    }
    if (formType === 'loan') {
      if (!requireUser()) return;
      const user = currentUser();
      if (hasOverdueLoan(user.id)) throw new Error('Tienes un préstamo atrasado. Registra su devolución antes de solicitar otro.');
      const book = getBook(form.dataset.bookId);
      const type = String(data.get('type'));
      if (!book || !book.published) throw new Error('Este libro ya no está disponible.');
      if (!['normal', 'reserva'].includes(type)) throw new Error('Selecciona un tipo de préstamo válido.');
      if (book.available < 1) throw new Error('No quedan ejemplares disponibles.');
      const now = Date.now();
      book.available -= 1;
      state.loans.push({
        id: makeId('loan'),
        bookId: book.id,
        userId: user.id,
        type,
        createdAt: new Date(now).toISOString(),
        dueAt: new Date(now + (type === 'reserva' ? 2 * 60 : 7 * 24 * 60) * 60 * 1000).toISOString(),
        returnedAt: null,
      });
      saveState();
      showNotice('Solicitud de préstamo registrada.');
      route();
      return;
    }
    if (formType === 'book') {
      if (!requireAdmin()) return;
      const bookId = form.dataset.bookId;
      const existingBook = bookId ? getBook(bookId) : null;
      const available = Number(data.get('available'));
      const year = Number(data.get('year'));
      if (!Number.isInteger(available) || available < 0) {
        throw new Error('Los ejemplares disponibles deben ser un número igual o mayor que cero.');
      }
      if (!Number.isInteger(year) || year < 0) throw new Error('Ingresa un año válido.');
      const bookData = {
        title: String(data.get('title') || '').trim(),
        author: String(data.get('author') || '').trim(),
        year,
        available,
        image: String(data.get('image') || '').trim(),
        description: String(data.get('description') || '').trim(),
        featured: data.has('featured'),
        published: data.has('published'),
      };
      if (!bookData.title || !bookData.author) throw new Error('El título y el autor son obligatorios.');
      if (existingBook) Object.assign(existingBook, bookData);
      else state.books.push({ id: makeId('book'), ...bookData });
      saveState();
      showNotice(existingBook ? 'Libro actualizado.' : 'Libro agregado.');
      location.hash = '#admin';
    }
  }

  function deleteBook(bookId) {
    if (!isAdmin()) throw new Error('Solo administración puede eliminar libros.');
    const book = getBook(bookId);
    if (!book || !window.confirm(`¿Eliminar "${book.title}" y su historial de préstamos?`)) return;
    state.books = state.books.filter((entry) => entry.id !== bookId);
    state.loans = state.loans.filter((loan) => loan.bookId !== bookId);
    saveState();
    showNotice('Libro e historial eliminados.');
    route();
  }

  function returnLoan(loanId) {
    if (!isAdmin()) throw new Error('Solo administración puede registrar devoluciones.');
    const loan = state.loans.find((entry) => entry.id === loanId);
    if (!loan || loan.returnedAt) return;
    loan.returnedAt = new Date().toISOString();
    const book = getBook(loan.bookId);
    if (book) book.available += 1;
    saveState();
    showNotice('Devolución registrada y ejemplar repuesto.');
    route();
  }

  function handleClick(event) {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    try {
      if (button.dataset.action === 'logout') {
        state.sessionUserId = null;
        saveState();
        showNotice('Sesión local cerrada.');
        location.hash = '#inicio';
      } else if (button.dataset.action === 'delete-book') {
        deleteBook(button.dataset.bookId);
      } else if (button.dataset.action === 'return-loan') {
        returnLoan(button.dataset.loanId);
      }
    } catch (error) {
      showNotice(error.message, 'error');
    }
  }

  async function initialize() {
    try {
      state = readState();
      if (!state) await seedState();
      window.addEventListener('hashchange', route);
      document.addEventListener('submit', async (event) => {
        const form = event.target.closest('form[data-form]');
        if (!form) return;
        event.preventDefault();
        const submitButton = form.querySelector('[type="submit"]');
        if (submitButton) submitButton.disabled = true;
        try {
          await handleFormSubmit(form);
        } catch (error) {
          showNotice(error.message, 'error');
        } finally {
          if (submitButton?.isConnected) submitButton.disabled = false;
        }
      });
      document.addEventListener('click', handleClick);
      route();
    } catch (error) {
      app.innerHTML = `
        <section class="modal-login">
          <h1>No se pudo abrir BiblioTech local</h1>
          <p class="warning-panel">${escapeHtml(error.message)}</p>
          <p>Prueba con Chrome o Edge actualizado y verifica que el almacenamiento del navegador esté habilitado.</p>
        </section>`;
      updateNavigation();
    }
  }

  initialize();
})();
