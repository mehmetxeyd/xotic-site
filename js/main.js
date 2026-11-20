const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

// Mobile nav toggle
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');

if (navToggle && navLinks) {
  const setOpen = (open) => {
    navLinks.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', open);
    navToggle.textContent = open ? 'Close' : 'Menu';
  };
  navToggle.addEventListener('click', () => setOpen(!navLinks.classList.contains('open')));
  navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
}

// Scroll reveal
const revealEls = document.querySelectorAll('.reveal');
if ('IntersectionObserver' in window && !reduceMotion) {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(el => observer.observe(el));
} else {
  revealEls.forEach(el => el.classList.add('is-visible'));
}

// Mark active nav link
const currentPath = window.location.pathname.split('/').pop() || 'index.html';
document.querySelectorAll('.nav-links a').forEach(link => {
  const href = link.getAttribute('href');
  if (href === currentPath || href.replace('.html', '') === currentPath) {
    link.classList.add('active');
    link.setAttribute('aria-current', 'page');
  }
});

// Scroll progress bar
const progress = document.querySelector('.scroll-progress');
if (progress) {
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    progress.style.transform = 'scaleX(' + (max > 0 ? window.scrollY / max : 0) + ')';
  };
  window.addEventListener('scroll', update, { passive: true });
  update();
}

// Pointer effects (desktop only, off for reduced motion)
if (finePointer && !reduceMotion) {
  // 3D tilt
  document.querySelectorAll('[data-tilt]').forEach(el => {
    const max = 6;
    el.addEventListener('pointerenter', () => { el.style.transitionDelay = '0s'; });
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      el.style.transform = `perspective(900px) rotateX(${(-y * max).toFixed(2)}deg) rotateY(${(x * max).toFixed(2)}deg) translateY(-4px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });

  // Cursor glow
  document.querySelectorAll('[data-glow]').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--gx', (e.clientX - r.left) + 'px');
      el.style.setProperty('--gy', (e.clientY - r.top) + 'px');
    });
  });

  // Magnetic buttons
  document.querySelectorAll('[data-magnetic]').forEach(el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * 0.18}px, ${y * 0.3}px)`;
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  });
}

// Contact form — sends via Web3Forms (see contact.html for setup)
const contactForm = document.querySelector('#contact-form');
if (contactForm) {
  const status = contactForm.querySelector('#form-status');
  const button = contactForm.querySelector('button[type="submit"]');
  const show = (msg, type) => {
    status.textContent = msg;
    status.className = 'form-status mono-caption is-visible is-' + type;
  };

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!contactForm.checkValidity()) {
      contactForm.reportValidity();
      return;
    }

    const key = contactForm.querySelector('input[name="access_key"]').value;
    if (!key || key === 'YOUR_WEB3FORMS_ACCESS_KEY_HERE') {
      show('The form isn’t set up yet. Please email info@xotic.dev directly.', 'error');
      return;
    }

    const data = Object.fromEntries(new FormData(contactForm));
    data.replyto = data.email;

    button.disabled = true;
    button.textContent = 'Sending…';

    try {
      const res = await fetch(contactForm.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || 'Send failed');
      contactForm.reset();
      show('Thanks, your message was sent. I’ll reply soon.', 'success');
    } catch (err) {
      show('Something went wrong. Please email info@xotic.dev instead.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Send message';
    }
  });
}

// "Save as PDF" on the CV page
const printBtn = document.querySelector('#print-cv');
if (printBtn) printBtn.addEventListener('click', () => window.print());
