// Live repository list from the public GitHub API (no token needed).
// Unauthenticated requests are limited to 60/hour per visitor IP, so the
// result is cached for the browser session.
(function () {
  const list = document.querySelector('#repo-list');
  if (!list) return;

  const user = list.dataset.user;
  const cacheKey = 'repos:' + user;
  const fmt = new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric' });

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text) node.textContent = text;
    return node;
  }

  function render(repos) {
    list.textContent = '';
    const visible = repos
      .filter(r => !r.fork && !r.archived)
      .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at));

    if (!visible.length) {
      list.append(el('li', 'repo-empty mono-caption', 'No public repositories yet.'));
      return;
    }

    visible.forEach(r => {
      const li = el('li');
      const a = el('a');
      a.href = r.html_url;
      a.target = '_blank';
      a.rel = 'noopener';

      const main = el('span');
      main.append(el('span', 'repo-name', r.name));
      if (r.description) main.append(el('span', 'repo-desc', r.description));

      a.append(
        main,
        el('span', 'mono-caption', r.language || '—'),
        el('span', 'mono-caption repo-updated', 'Updated ' + fmt.format(new Date(r.pushed_at)))
      );
      li.append(a);
      list.append(li);
    });
  }

  function fail() {
    const note = document.querySelector('.repos-note');
    if (note) note.textContent = 'Couldn’t reach GitHub right now. Showing the saved list.';
  }

  const btn = document.querySelector('#load-repos');

  function load() {
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
    fetch('https://api.github.com/users/' + encodeURIComponent(user) + '/repos?per_page=100&sort=pushed')
      .then(res => { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then(repos => {
        render(repos);
        try { sessionStorage.setItem(cacheKey, JSON.stringify(repos)); } catch (e) { /* ignore */ }
        if (btn) btn.textContent = 'Live from GitHub ✓';
      })
      .catch(() => { fail(); if (btn) { btn.disabled = false; btn.textContent = 'Try again'; } });
  }

  // Only contact GitHub after the visitor asks (privacy: no third-party request by default)
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      render(JSON.parse(cached));
      if (btn) { btn.disabled = true; btn.textContent = 'Live from GitHub ✓'; }
    }
  } catch (e) { /* storage unavailable */ }

  if (btn) btn.addEventListener('click', load);
})();

// Copy-to-clipboard buttons
document.querySelectorAll('[data-copy]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const label = btn.querySelector('.copy-label');
    try {
      await navigator.clipboard.writeText(btn.dataset.copy);
      if (label) label.textContent = 'Copied';
    } catch (e) {
      if (label) label.textContent = 'Select & copy';
    }
    setTimeout(() => { if (label) label.textContent = 'Copy'; }, 1800);
  });
});
