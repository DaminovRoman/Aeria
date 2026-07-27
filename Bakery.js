/* ==========================================================================
   ATELIER PÂTISSERIE ÉLYSÉE — Bakery.js
   Vanilla JS only. No libraries.
   ========================================================================== */

(function () {
  'use strict';

  var prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var isTouch = window.matchMedia('(hover: none)').matches;

  /* ========================================================================
     1. SOFT REVEAL — IntersectionObserver
     Trigger: element enters viewport (15% threshold)
     Delay: staggered by DOM order within a parent, 90ms increments, capped
     Duration: handled in CSS (var(--dur-med))
     Easing: handled in CSS (var(--ease-silk))
     GPU: toggles opacity/transform/filter only, already will-change in CSS
     Purpose: content rises out of soft blur as the gallery visitor "arrives"
     ======================================================================== */

  function initReveal() {
    var items = document.querySelectorAll('[data-reveal]');
    if (!items.length) return;

    if (prefersReducedMotion) {
      items.forEach(function (el) { el.classList.add('is-visible'); });
      return;
    }

    // group by parent to stagger siblings, cap stagger so long lists don't lag
    var groups = new Map();
    items.forEach(function (el) {
      var parent = el.parentElement;
      if (!groups.has(parent)) groups.set(parent, []);
      groups.get(parent).push(el);
    });

    var indexMap = new Map();
    groups.forEach(function (list) {
      list.forEach(function (el, i) {
        indexMap.set(el, Math.min(i, 5)); // cap stagger at 5 * 90ms
      });
    });

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          var delay = (indexMap.get(entry.target) || 0) * 90;
          entry.target.style.transitionDelay = delay + 'ms';
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

    items.forEach(function (el) { observer.observe(el); });
  }

  /* ========================================================================
     2. HERO SPLIT-REVEAL TITLE
     Trigger: DOMContentLoaded | Delay: 400ms | Duration: 900ms per word
     Easing: var(--ease-cream) | Purpose: macro-focus effect, blur -> sharp
     ======================================================================== */

  function initHeroSplit() {
    var el = document.querySelector('[data-split-reveal]');
    if (!el || prefersReducedMotion) return;

    var text = el.innerHTML;
    // split on <br> boundaries preserved, wrap words only (lightweight, no libs)
    var lines = text.split('<br>');
    el.innerHTML = '';

    lines.forEach(function (line, li) {
      var lineWrap = document.createElement('span');
      lineWrap.style.display = 'block';
      var words = line.trim().split(' ');
      words.forEach(function (word, wi) {
        var span = document.createElement('span');
        span.style.display = 'inline-block';
        span.style.opacity = '0';
        span.style.filter = 'blur(10px)';
        span.style.transform = 'translateY(18px)';
        span.style.transition = 'opacity 900ms cubic-bezier(0.22,1,0.36,1), filter 900ms cubic-bezier(0.22,1,0.36,1), transform 900ms cubic-bezier(0.22,1,0.36,1)';
        span.style.transitionDelay = (400 + (li * 3 + wi) * 90) + 'ms';
        span.innerHTML = word + '&nbsp;';
        lineWrap.appendChild(span);
      });
      el.appendChild(lineWrap);
    });

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        el.querySelectorAll('span span').forEach(function (span) {
          span.style.opacity = '1';
          span.style.filter = 'blur(0)';
          span.style.transform = 'translateY(0)';
        });
      });
    });
  }

  /* ========================================================================
     3. GALLERY RAIL — active section tracking + progress + click-to-scroll
     Trigger: scroll (rAF-throttled) | Purpose: museum-wall wayfinding
     ======================================================================== */

  function initRail() {
    var railItems = document.querySelectorAll('.rail__item');
    var progressEl = document.getElementById('railProgress');
    if (!railItems.length) return;

    var sections = [];
    railItems.forEach(function (item) {
      var target = document.getElementById(item.getAttribute('data-target'));
      if (target) sections.push({ item: item, el: target });
      item.addEventListener('click', function () {
        if (target) target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      });
    });

    var ticking = false;

    function update() {
      var scrollY = window.scrollY;
      var docHeight = document.documentElement.scrollHeight - window.innerHeight;
      var progress = docHeight > 0 ? Math.min(scrollY / docHeight, 1) : 0;
      if (progressEl) progressEl.style.height = (progress * 100) + '%';

      var viewportMid = scrollY + window.innerHeight * 0.4;
      var activeIdx = 0;
      sections.forEach(function (s, i) {
        if (s.el.offsetTop <= viewportMid) activeIdx = i;
      });
      sections.forEach(function (s, i) {
        s.item.classList.toggle('is-active', i === activeIdx);
      });
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });

    update();
  }

  /* ========================================================================
     3b. TOPBAR SCROLL STATE
     Trigger: scroll (rAF-throttled) | Purpose: header starts transparent over
     the hero and gains a soft glass background once the page has scrolled
     past a small threshold, so it stays readable over any section below.
     ======================================================================== */

  function initTopbarScroll() {
    var topbar = document.querySelector('.topbar');
    if (!topbar) return;

    var threshold = 40; // px scrolled before the glass background appears
    var ticking = false;

    function update() {
      topbar.classList.toggle('is-scrolled', window.scrollY > threshold);
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    }, { passive: true });

    update();
  }

  /* ========================================================================
     4. AMBIENT GLAZE CURSOR TRAIL (canvas)
     Trigger: pointermove | Purpose: signature ambient "drizzle" effect
     GPU: canvas 2D, cleared each frame via fading circles, requestAnimationFrame
     Disabled on touch devices and reduced motion (see CSS + guard below)
     ======================================================================== */

  function initGlazeTrail() {
    var canvas = document.getElementById('glaze-canvas');
    if (!canvas || prefersReducedMotion || isTouch) {
      if (canvas) canvas.remove();
      return;
    }
    var ctx = canvas.getContext('2d');
    var points = [];
    var w, h;

    function resize() {
      w = canvas.width = window.innerWidth * window.devicePixelRatio;
      h = canvas.height = window.innerHeight * window.devicePixelRatio;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }
    resize();
    window.addEventListener('resize', resize);

    window.addEventListener('pointermove', function (e) {
      points.push({ x: e.clientX, y: e.clientY, life: 1 });
      if (points.length > 26) points.shift();
    });

    function loop() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      points.forEach(function (p, i) {
        p.life -= 0.035;
        if (p.life > 0) {
          ctx.beginPath();
          var r = 10 * p.life;
          ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(184, 152, 90, ' + (p.life * 0.28) + ')';
          ctx.fill();
        }
      });
      points = points.filter(function (p) { return p.life > 0; });
      requestAnimationFrame(loop);
    }
    requestAnimationFrame(loop);
  }

  /* ========================================================================
     5. MAGNETIC BUTTONS
     Trigger: pointermove within bounds | Duration: 180ms release spring
     Purpose: buttons pull gently toward cursor, signal premium interactivity
     ======================================================================== */

  function initMagneticButtons() {
    if (prefersReducedMotion || isTouch) return;
    var buttons = document.querySelectorAll('.magnetic');

    buttons.forEach(function (btn) {
      btn.addEventListener('pointermove', function (e) {
        var rect = btn.getBoundingClientRect();
        var relX = e.clientX - rect.left - rect.width / 2;
        var relY = e.clientY - rect.top - rect.height / 2;
        btn.style.setProperty('--mx', (relX * 0.25).toFixed(2));
        btn.style.setProperty('--my', (relY * 0.25).toFixed(2));
      });
      btn.addEventListener('pointerleave', function () {
        btn.style.setProperty('--mx', 0);
        btn.style.setProperty('--my', 0);
      });
    });
  }

  /* ========================================================================
     6. MOBILE MENU TOGGLE
     ======================================================================== */

  function initMenu() {
    var toggle = document.getElementById('menuToggle');
    var overlay = document.getElementById('menuOverlay');
    var topbar = document.querySelector('.topbar');
    if (!toggle || !overlay) return;

    var scrollThreshold = 40;

    function close() {
      overlay.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      // restore the topbar to whatever its real scroll position calls for
      if (topbar) topbar.classList.toggle('is-scrolled', window.scrollY > scrollThreshold);
    }

    toggle.addEventListener('click', function () {
      var isOpen = overlay.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(isOpen));
      document.body.style.overflow = isOpen ? 'hidden' : '';
      // menu overlay is dark, so the topbar always needs its glass background
      // while it's open, regardless of scroll position
      if (topbar) topbar.classList.toggle('is-scrolled', isOpen || window.scrollY > scrollThreshold);
    });

    overlay.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', close);
    });
  }

  /* ========================================================================
     7. TESTIMONIAL CAROUSEL (Silk Transition)
     Trigger: arrow/dot click | Duration: var(--dur-med) | Easing: var(--ease-silk)
     GPU: transform: translateX only
     ======================================================================== */

  function initVoicesCarousel() {
    var track = document.getElementById('voicesTrack');
    var prevBtn = document.getElementById('voicesPrev');
    var nextBtn = document.getElementById('voicesNext');
    var dotsWrap = document.getElementById('voicesDots');
    if (!track) return;

    var slides = track.children.length;
    var current = 0;

    for (var i = 0; i < slides; i++) {
      var dot = document.createElement('button');
      dot.className = 'voices__dot' + (i === 0 ? ' is-active' : '');
      dot.setAttribute('aria-label', 'Отзыв ' + (i + 1));
      dot.addEventListener('click', function (idx) {
        return function () { goTo(idx); };
      }(i));
      dotsWrap.appendChild(dot);
    }

    function goTo(idx) {
      current = (idx + slides) % slides;
      track.style.transform = 'translateX(' + (-current * 100) + '%)';
      Array.prototype.forEach.call(dotsWrap.children, function (d, i) {
        d.classList.toggle('is-active', i === current);
      });
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(current - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(current + 1); });

    // basic swipe support
    var startX = null;
    track.addEventListener('pointerdown', function (e) { startX = e.clientX; });
    track.addEventListener('pointerup', function (e) {
      if (startX === null) return;
      var diff = e.clientX - startX;
      if (diff > 50) goTo(current - 1);
      else if (diff < -50) goTo(current + 1);
      startX = null;
    });
  }

  /* ========================================================================
     8. FAQ ACCORDION
     Trigger: click | Duration: var(--dur-med) via CSS grid-template-rows
     Purpose: only one panel open at a time, height-animated without JS heights
     ======================================================================== */

  function initAccordion() {
    var items = document.querySelectorAll('.accordion__item');
    items.forEach(function (item) {
      var trigger = item.querySelector('.accordion__trigger');
      trigger.addEventListener('click', function () {
        var isOpen = item.classList.contains('is-open');
        items.forEach(function (other) {
          other.classList.remove('is-open');
          other.querySelector('.accordion__trigger').setAttribute('aria-expanded', 'false');
        });
        if (!isOpen) {
          item.classList.add('is-open');
          trigger.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  /* ========================================================================
     9. ORDER MODAL
     Trigger: any "order" CTA | Purpose: capture inquiry without leaving page
     ======================================================================== */

  function initModal() {
    var modal = document.getElementById('orderModal');
    var backdrop = document.getElementById('modalBackdrop');
    var closeBtn = document.getElementById('modalClose');
    var form = document.getElementById('orderForm');
    var success = document.getElementById('modalSuccess');
    var openers = [
      document.getElementById('openOrderTop'),
      document.getElementById('openOrderHero'),
      document.getElementById('openOrderDetail'),
      document.getElementById('openOrderFinal')
    ];

    if (!modal) return;

    var eyebrow = document.getElementById('orderModalTitle');
    var heading = document.getElementById('modalHeading');
    var eyebrowDefault = eyebrow ? eyebrow.textContent : '';
    var headingDefault = heading ? heading.textContent : '';

    function open() {
      modal.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      form.style.display = '';
      form.reset();
      success.classList.remove('is-visible');
      if (eyebrow) eyebrow.textContent = eyebrowDefault;
      if (heading) heading.textContent = headingDefault;
      var firstField = form.querySelector('input');
      if (firstField) setTimeout(function () { firstField.focus(); }, 350);
    }

    function close() {
      modal.classList.remove('is-open');
      document.body.style.overflow = '';
    }

    openers.forEach(function (btn) {
      if (btn) btn.addEventListener('click', open);
    });

    if (backdrop) backdrop.addEventListener('click', close);
    if (closeBtn) closeBtn.addEventListener('click', close);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
    });

    if (form) {
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        form.style.display = 'none';
        success.classList.add('is-visible');
        if (eyebrow) eyebrow.textContent = 'Спасибо';
        if (heading) heading.textContent = 'Заявка принята';
      });
    }
  }

  /* ========================================================================
     10. DESSERT DETAIL SYNC (collection click -> scroll to detail template)
     ======================================================================== */

  function initExhibitClicks() {
    var exhibits = document.querySelectorAll('.exhibit');
    var detail = document.getElementById('detail');
    exhibits.forEach(function (ex) {
      ex.addEventListener('click', function () {
        if (detail) detail.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      });
      ex.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (detail) detail.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
        }
      });
    });
  }

  /* ======================================================================== */

  /* ========================================================================
     0. PRELOADER
     Trigger: DOMContentLoaded -> fills rule | Hides on window load,
     with a minimum display time so it never just flashes on fast connections
     ======================================================================== */

  function initPreloader() {
    var preloader = document.getElementById('preloader');
    var fill = document.getElementById('preloaderFill');
    if (!preloader) return;

    document.body.style.overflow = 'hidden';
    var minVisible = prefersReducedMotion ? 0 : 900;
    var startedAt = Date.now();

    if (fill) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { fill.style.width = '100%'; });
      });
    }

    function hide() {
      var elapsed = Date.now() - startedAt;
      var wait = Math.max(0, minVisible - elapsed);
      setTimeout(function () {
        preloader.classList.add('is-hidden');
        document.body.style.overflow = '';
      }, wait);
    }

    if (document.readyState === 'complete') {
      hide();
    } else {
      window.addEventListener('load', hide);
      // Safety net: never let the preloader hang the page indefinitely
      setTimeout(hide, 4000);
    }
  }

  /* ======================================================================== */

  document.addEventListener('DOMContentLoaded', function () {
    initPreloader();
    initReveal();
    initHeroSplit();
    initRail();
    initTopbarScroll();
    initGlazeTrail();
    initMagneticButtons();
    initMenu();
    initVoicesCarousel();
    initAccordion();
    initModal();
    initExhibitClicks();
  });

})();
