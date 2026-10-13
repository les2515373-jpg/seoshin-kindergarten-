/* 가정통신문 화면 그리기 + 크게 보기(뷰어)
   목록 내용은 letters-data.js 에서 고칩니다. 이 파일은 고칠 필요가 없습니다. */
(function () {
  var LETTERS = window.SEOSHIN_LETTERS || [];
  var NEW_DAYS = 14;

  function img(id, p) { return 'images/letters/letter-' + id + '-' + p + '.jpg'; }
  function month(id) { var m = id.split('-'); return { key: m[0] + '-' + m[1], label: m[0] + '년 ' + (+m[1]) + '월' }; }
  function startDate(l) { var d = l.date.split('~')[0].trim().split('.'); return new Date(+d[0], +d[1] - 1, +d[2]); }
  function isNew(l) { return (Date.now() - startDate(l)) / 864e5 < NEW_DAYS; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function card(l, cls) {
    var i = LETTERS.indexOf(l);
    return '<article class="' + cls + '">' +
      '<a href="' + img(l.id, 1) + '" class="lc-thumb" data-open="' + i + '" data-page="1">' +
        '<img src="' + img(l.id, 1) + '" alt="' + esc(l.id.slice(0, 4) + '년 ' + l.title) + ' 서신어린이집 가정통신문" loading="lazy">' +
        (isNew(l) ? '<span class="lc-new">NEW</span>' : '') +
      '</a>' +
      '<div class="lc-meta"><h3>' + esc(l.title) + '</h3><p class="lc-date">' + esc(l.date) + '</p>' +
        (l.topic ? '<p class="lc-topic"><span>부모교육</span>' + esc(l.topic) + '</p>' : '') +
        '<div class="lc-pages">' +
          '<a href="' + img(l.id, 1) + '" data-open="' + i + '" data-page="1">1면 주간소식</a>' +
          '<a href="' + img(l.id, 2) + '" data-open="' + i + '" data-page="2">2면 부모교육</a>' +
        '</div></div></article>';
  }

  /* ── 홈페이지: 최신호 크게 + 최근 3개 ── */
  window.renderLatestLetters = function (el) {
    if (!el || !LETTERS.length) return;
    var l = LETTERS[0], i = 0;
    var html = '<div class="lf-feature">' +
      '<div class="lf-pages">' +
        '<a href="' + img(l.id, 1) + '" data-open="0" data-page="1"><img src="' + img(l.id, 1) + '" alt="' + esc(l.title) + ' 가정통신문 1면"><span>1면 · 주간소식</span></a>' +
        '<a href="' + img(l.id, 2) + '" data-open="0" data-page="2"><img src="' + img(l.id, 2) + '" alt="' + esc(l.title) + ' 가정통신문 2면" loading="lazy"><span>2면 · 부모교육</span></a>' +
      '</div>' +
      '<div class="lf-info">' +
        '<span class="lf-badge">' + (isNew(l) ? '✨ 이번 주 가정통신문' : '📮 가장 최근 가정통신문') + '</span>' +
        '<h3>' + esc(l.title) + '</h3>' +
        '<p class="lf-date">' + esc(l.date) + '</p>' +
        (l.topic ? '<div class="lf-topic"><b>이번 주 부모교육자료</b>' + esc(l.topic) + '</div>' : '') +
        '<button type="button" class="lf-read" data-open="0" data-page="1">크게 읽어보기 →</button>' +
      '</div></div>';
    var rest = LETTERS.slice(1, 5);
    if (rest.length) {
      html += '<h3 class="lf-sub">지난 소식</h3><div class="lc-grid">' +
        rest.map(function (x) { return card(x, 'lc-card'); }).join('') + '</div>';
    }
    el.innerHTML = html;
  };

  /* ── 보관함 페이지: 월 선택 + 주제 검색 ── */
  window.renderLetterArchive = function (opts) {
    var list = opts.list, nav = opts.nav, search = opts.search, empty = opts.empty, count = opts.count;
    var months = [];
    LETTERS.forEach(function (l) { var m = month(l.id); if (!months.some(function (x) { return x.key === m.key; })) months.push(m); });
    var active = 'all', preset = null;
    nav.innerHTML = '<button type="button" data-m="all" class="on">전체</button>' +
      months.map(function (m) { return '<button type="button" data-m="' + m.key + '">' + m.label.slice(6) + '</button>'; }).join('');
    if (count) count.textContent = LETTERS.length;

    function draw() {
      // 낱말 여러 개는 '하나라도 들어 있으면' 보여 줍니다
      var words = preset || (search.value || '').trim().toLowerCase().split(/\s+/).filter(Boolean);
      var html = '', n = 0;
      months.forEach(function (m) {
        if (active !== 'all' && active !== m.key) return;
        var items = LETTERS.filter(function (l) {
          var text = (l.title + ' ' + l.topic + ' ' + l.date).toLowerCase();
          return month(l.id).key === m.key && (!words.length || words.some(function (w) { return text.indexOf(w) > -1; }));
        });
        if (!items.length) return;
        n += items.length;
        html += '<section class="lt-month" id="m' + m.key + '"><h2>' + m.label + '<small>' + items.length + '호</small></h2>' +
          '<div class="lc-grid">' + items.map(function (l) { return card(l, 'lc-card'); }).join('') + '</div></section>';
      });
      list.innerHTML = html;
      empty.hidden = n > 0;
    }
    nav.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      active = b.getAttribute('data-m');
      [].forEach.call(nav.children, function (x) { x.classList.toggle('on', x === b); });
      draw();
      window.scrollTo({ top: list.getBoundingClientRect().top + window.pageYOffset - 150, behavior: 'smooth' });
    });
    search.addEventListener('input', function () { preset = null; draw(); });
    [].forEach.call(document.querySelectorAll('[data-q]'), function (b) {
      b.addEventListener('click', function () {
        preset = b.getAttribute('data-q').split(' ');
        search.value = b.textContent;
        active = 'all';
        [].forEach.call(nav.children, function (x) { x.classList.toggle('on', x.getAttribute('data-m') === 'all'); });
        draw();
      });
    });
    draw();
  };

  /* ── 크게 보기 (뷰어) ── */
  var box, cur = 0, page = 1, tx = null;
  function build() {
    box = document.createElement('div');
    box.className = 'lv';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML =
      '<div class="lv-bar">' +
        '<div class="lv-title"><b></b><span></span></div>' +
        '<div class="lv-tabs"><button type="button" data-p="1">1면</button><button type="button" data-p="2">2면</button></div>' +
        '<button type="button" class="lv-x" aria-label="닫기">✕</button>' +
      '</div>' +
      '<div class="lv-stage"><img alt=""></div>' +
      '<button type="button" class="lv-nav lv-prev" aria-label="이전">‹</button>' +
      '<button type="button" class="lv-nav lv-next" aria-label="다음">›</button>' +
      '<div class="lv-foot"><span class="lv-hint">← → 또는 옆으로 밀어서 넘기기</span><a class="lv-orig" target="_blank" rel="noopener">원본 크기로 보기 ↗</a></div>';
    document.body.appendChild(box);
    box.querySelector('.lv-x').onclick = close;
    box.querySelector('.lv-prev').onclick = function () { step(-1); };
    box.querySelector('.lv-next').onclick = function () { step(1); };
    box.querySelector('.lv-tabs').onclick = function (e) { var b = e.target.closest('button'); if (b) show(cur, +b.getAttribute('data-p')); };
    box.querySelector('.lv-stage').onclick = function (e) { if (e.target === this) close(); };
    box.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
    box.addEventListener('touchend', function (e) {
      if (tx === null) return; var dx = e.changedTouches[0].clientX - tx; tx = null;
      if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
    });
  }
  // 1면 → 2면 → 다음 호(더 지난 호) 1면 순서로 넘깁니다
  function step(d) {
    if (d > 0) { if (page === 1) show(cur, 2); else if (cur < LETTERS.length - 1) show(cur + 1, 1); }
    else { if (page === 2) show(cur, 1); else if (cur > 0) show(cur - 1, 2); }
  }
  function show(i, p) {
    cur = i; page = p;
    var l = LETTERS[i], src = img(l.id, p);
    var im = box.querySelector('.lv-stage img');
    im.src = src; im.alt = l.title + ' 가정통신문 ' + p + '면';
    box.querySelector('.lv-stage').scrollTop = 0;
    box.querySelector('.lv-title b').textContent = l.id.slice(0, 4) + '년 ' + l.title;
    box.querySelector('.lv-title span').textContent = p === 2 && l.topic ? '부모교육 · ' + l.topic : l.date;
    box.querySelector('.lv-orig').href = src;
    [].forEach.call(box.querySelectorAll('.lv-tabs button'), function (b) { b.classList.toggle('on', +b.getAttribute('data-p') === p); });
    box.querySelector('.lv-prev').disabled = i === 0 && p === 1;
    box.querySelector('.lv-next').disabled = i === LETTERS.length - 1 && p === 2;
    history.replaceState(null, '', '#letter-' + l.id + '-' + p);
    // 다음 장 미리 불러오기
    var nx = p === 1 ? img(l.id, 2) : (LETTERS[i + 1] && img(LETTERS[i + 1].id, 1));
    if (nx) (new Image()).src = nx;
  }
  function open(i, p) {
    if (!box) build();
    box.classList.add('on');
    document.documentElement.style.overflow = 'hidden';
    show(i, p);
    box.querySelector('.lv-x').focus();
  }
  function close() {
    box.classList.remove('on');
    document.documentElement.style.overflow = '';
    history.replaceState(null, '', location.pathname + location.search);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-open]');
    if (!a || e.ctrlKey || e.metaKey || e.shiftKey) return;
    e.preventDefault();
    open(+a.getAttribute('data-open'), +a.getAttribute('data-page') || 1);
  });
  document.addEventListener('keydown', function (e) {
    if (!box || !box.classList.contains('on')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
  });
  // 공유받은 링크(#letter-2026-10-w2-1)로 들어오면 바로 열기
  window.addEventListener('load', function () {
    var m = location.hash.match(/^#letter-(\d{4}-\d{2}-w\d)-([12])$/);
    if (!m) return;
    var i = LETTERS.map(function (l) { return l.id; }).indexOf(m[1]);
    if (i > -1) open(i, +m[2]);
  });
})();
