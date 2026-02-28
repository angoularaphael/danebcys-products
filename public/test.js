const BASE = '';
const LOG = document.getElementById('log-output');

function log(msg, cls = 'log-info') {
  const t = new Date().toLocaleTimeString('fr-FR');
  LOG.innerHTML += `<div class="log-entry"><span class="log-time">[${t}]</span> <span class="${cls}">${msg}</span></div>`;
  LOG.scrollTop = LOG.scrollHeight;
}

function show(boxId, jsonId, data) {
  const box = document.getElementById(boxId);
  const pre = document.getElementById(jsonId);
  box.style.display = 'block';
  pre.textContent = JSON.stringify(data, null, 2);
}

function getToken() {
  return document.getElementById('auth-token').value.trim();
}

function getServiceKey() {
  return document.getElementById('service-key').value.trim();
}

function authHeaders() {
  const h = { 'Content-Type': 'application/json' };
  const tk = getToken();
  if (tk) h['Authorization'] = `Bearer ${tk}`;
  return h;
}

function serviceHeaders() {
  const h = { 'Content-Type': 'application/json' };
  const sk = getServiceKey();
  if (sk) h['X-Service-Key'] = sk;
  return h;
}

async function api(method, path, body, headers) {
  const opts = { method, headers: headers || authHeaders() };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  log(`${method} ${path}`, 'log-info');
  try {
    const res = await fetch(BASE + path, opts);
    const data = await res.json();
    if (res.ok) {
      log(`${res.status} OK`, 'log-ok');
    } else {
      log(`${res.status} ${data.error || 'Erreur'}`, 'log-err');
    }
    return data;
  } catch (err) {
    log(`Erreur réseau: ${err.message}`, 'log-err');
    return { error: err.message };
  }
}

// Health check
async function checkHealth() {
  try {
    const res = await fetch(BASE + '/health');
    const data = await res.json();
    const el = document.getElementById('health-status');
    if (data.status === 'ok') {
      el.innerHTML = '<span class="status-dot ok"></span><span style="font-size:13px">En ligne</span>';
      log('Service en ligne', 'log-ok');
    } else {
      el.innerHTML = '<span class="status-dot err"></span><span style="font-size:13px">Erreur</span>';
    }
  } catch (err) {
    document.getElementById('health-status').innerHTML =
      '<span class="status-dot err"></span><span style="font-size:13px">Hors ligne</span>';
    log('Service hors ligne', 'log-err');
  }
}

// Load categories into selects
async function loadCategories() {
  try {
    const res = await fetch(BASE + '/api/v1/products/categories');
    const data = await res.json();
    if (!data.categories) return;

    const selects = ['create-category'];
    for (const selId of selects) {
      const sel = document.getElementById(selId);
      const first = sel.options[0];
      sel.innerHTML = '';
      sel.appendChild(first);

      for (const parent of data.categories) {
        const optgroup = document.createElement('optgroup');
        optgroup.label = parent.name;
        const pOpt = document.createElement('option');
        pOpt.value = parent.id;
        pOpt.textContent = `${parent.name} (toutes)`;
        optgroup.appendChild(pOpt);
        for (const child of (parent.children || [])) {
          const opt = document.createElement('option');
          opt.value = child.id;
          opt.textContent = child.name;
          optgroup.appendChild(opt);
        }
        sel.appendChild(optgroup);
      }
    }
    log(`${data.categories.length} catégories chargées`, 'log-ok');
  } catch (_e) {
    log('Impossible de charger les catégories', 'log-warn');
  }
}

// Détail produit
document.getElementById('btn-detail').addEventListener('click', async () => {
  const id = document.getElementById('detail-id').value.trim();
  if (!id) return log('ID requis', 'log-warn');
  const data = await api('GET', `/api/v1/products/${id}`);
  show('detail-raw', 'detail-json', data);

  const container = document.getElementById('detail-results');
  container.innerHTML = '';
  if (data.error) {
    container.innerHTML = `<p style="color:#f85149">${data.error}</p>`;
    return;
  }
  const p = data.product;
  if (!p) return;

  let html = `
    <div class="detail-product">
      <div class="title">${escapeHtml(p.title)}</div>
      <div class="price">${Number(p.price).toFixed(2)} €</div>
      <div class="meta">${escapeHtml(p.description || '')} &bull; Stock: ${p.stock} &bull; ${p.city || '—'} &bull; ${p.viewsCount || 0} vues</div>
  `;
  if (data.rating && data.rating.count > 0) {
    const stars = '★'.repeat(Math.round(data.rating.average)) + '☆'.repeat(5 - Math.round(data.rating.average));
    html += `<div class="detail-rating">${stars} ${data.rating.average}/5 — ${data.rating.count} avis</div>`;
  }
  html += '</div>';

  if (data.reviews && data.reviews.length > 0) {
    html += '<div style="font-size:13px;font-weight:600;color:#8b949e;margin-bottom:8px">Avis récents</div>';
    for (const r of data.reviews) {
      const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
      const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString('fr-FR') : '';
      const author = r.userName ? escapeHtml(r.userName) : (r.userId ? `Utilisateur ${r.userId.slice(0, 8)}` : 'Anonyme');
      html += `
        <div class="review-card">
          <div style="font-weight:600;color:#f0883e;margin-bottom:4px">${author}</div>
          <span class="stars">${stars}</span> ${r.rating}/5
          ${r.comment ? `<div class="comment">${escapeHtml(r.comment)}</div>` : ''}
          <div class="date">${date}</div>
        </div>`;
    }
    if (data.reviewsPagination && data.reviewsPagination.total > data.reviews.length) {
      html += `<div style="font-size:12px;color:#484f58;margin-top:8px">${data.reviews.length} sur ${data.reviewsPagination.total} avis</div>`;
    }
  } else {
    html += '<div style="font-size:13px;color:#8b949e;margin-top:8px">Aucun avis</div>';
  }
  container.innerHTML = html;
});

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Categories
document.getElementById('btn-categories').addEventListener('click', async () => {
  const data = await api('GET', '/api/v1/products/categories');
  show('cat-raw', 'cat-json', data);
});

// Créer un produit
document.getElementById('btn-create').addEventListener('click', async () => {
  if (!getToken()) return log('Token requis pour créer', 'log-warn');
  const body = {
    title: document.getElementById('create-title').value.trim(),
    description: document.getElementById('create-desc').value.trim(),
    price: parseFloat(document.getElementById('create-price').value) || 0,
    stock: parseInt(document.getElementById('create-stock').value) || 1,
    categoryId: document.getElementById('create-category').value || undefined,
    city: document.getElementById('create-city').value.trim() || undefined
  };
  if (!body.title) return log('Titre requis', 'log-warn');
  const btn = document.getElementById('btn-create');
  btn.disabled = true;
  try {
    const data = await api('POST', '/api/v1/products', body);
    show('create-raw', 'create-json', data);
  } finally {
    btn.disabled = false;
  }
});

// Modifier
document.getElementById('btn-update').addEventListener('click', async () => {
  if (!getToken()) return log('Token requis pour modifier', 'log-warn');
  const id = document.getElementById('update-id').value.trim();
  if (!id) return log('ID requis', 'log-warn');
  const body = {};
  const title = document.getElementById('update-title').value.trim();
  const price = document.getElementById('update-price').value;
  if (title) body.title = title;
  if (price) body.price = parseFloat(price);
  const data = await api('PUT', `/api/v1/products/${id}`, body);
  show('update-raw', 'update-json', data);
});

// Supprimer
document.getElementById('btn-delete').addEventListener('click', async () => {
  if (!getToken()) return log('Token requis pour supprimer', 'log-warn');
  const id = document.getElementById('delete-id').value.trim();
  if (!id) return log('ID requis', 'log-warn');
  const data = await api('DELETE', `/api/v1/products/${id}`);
  show('delete-raw', 'delete-json', data);
});

// Mes annonces
document.getElementById('btn-myads').addEventListener('click', async () => {
  if (!getToken()) return log('Token requis', 'log-warn');
  const data = await api('GET', '/api/v1/products/me');
  show('myads-raw', 'myads-json', data);
});

// Ajouter un avis
document.getElementById('btn-review').addEventListener('click', async () => {
  if (!getToken()) return log('Token requis', 'log-warn');
  const productId = document.getElementById('review-product-id').value.trim();
  if (!productId) return log('ID produit requis', 'log-warn');
  const body = {
    rating: parseInt(document.getElementById('review-rating').value) || 5,
    comment: document.getElementById('review-comment').value.trim()
  };
  const data = await api('POST', `/api/v1/products/${productId}/reviews`, body);
  show('review-raw', 'review-json', data);
});

// Internal - get product
document.getElementById('btn-int-get').addEventListener('click', async () => {
  const id = document.getElementById('int-product-id').value.trim();
  if (!id) return log('Product ID requis', 'log-warn');
  const data = await api('GET', `/internal/products/${id}`, null, serviceHeaders());
  show('int-raw', 'int-json', data);
});

// Internal - update stock
document.getElementById('btn-int-stock').addEventListener('click', async () => {
  const id = document.getElementById('int-product-id').value.trim();
  const qty = parseInt(document.getElementById('int-stock-qty').value);
  if (!id) return log('Product ID requis', 'log-warn');
  if (isNaN(qty)) return log('Quantité requise', 'log-warn');
  const data = await api('PUT', `/internal/products/${id}/stock`, { quantity: qty }, serviceHeaders());
  show('int-raw', 'int-json', data);
});

// Internal - seller stats
document.getElementById('btn-int-stats').addEventListener('click', async () => {
  const sellerId = document.getElementById('int-seller-id').value.trim();
  if (!sellerId) return log('Seller ID requis', 'log-warn');
  const data = await api('GET', `/internal/products/seller/${sellerId}/stats`, null, serviceHeaders());
  show('int-raw', 'int-json', data);
});

// Init
checkHealth();
loadCategories();
