(function () {
  'use strict';

  var WEIGHT = { high: 3, medium: 2, low: 1 };
  var RISK_LABEL = { high: '高', medium: '中', low: '低' };
  var ANSWER_LABEL = { yes: '是', no: '否', unknown: '不清楚' };
  var VIEWS = ['qa', 'contract', 'checklist', 'about'];

  var DATA = { config: null, qa: null, rules: null, sources: null, checklists: null };

  var state = {
    view: 'qa',
    domain: 'job',
    category: 'all',
    q: '',
    checkerId: null,
    answers: {},
    checklistId: null
  };

  var el = {};

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function safeUrl(url) {
    return /^https?:\/\//i.test(url || '') ? url : '';
  }

  function fmt(n) {
    return Number.isInteger(n) ? String(n) : n.toFixed(1);
  }

  var LS = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (err) {
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch (err) {
        /* 隐私模式下忽略写入失败 */
      }
    },
    remove: function (key) {
      try {
        window.localStorage.removeItem(key);
      } catch (err) { /* 忽略 */ }
    }
  };

  function cacheEls() {
    el.error = document.getElementById('dataError');
    el.qaList = document.getElementById('qaList');
    el.qaMeta = document.getElementById('qaMeta');
    el.qaSearch = document.getElementById('qaSearch');
    el.domainTabs = document.getElementById('domainTabs');
    el.categoryChips = document.getElementById('categoryChips');
    el.checkerTabs = document.getElementById('checkerTabs');
    el.checkerDesc = document.getElementById('checkerDesc');
    el.checkForm = document.getElementById('checkForm');
    el.resultBox = document.getElementById('resultBox');
    el.checklistTabs = document.getElementById('checklistTabs');
    el.clDesc = document.getElementById('clDesc');
    el.clBar = document.getElementById('clBar');
    el.clMeta = document.getElementById('clMeta');
    el.clSteps = document.getElementById('clSteps');
    el.aboutBox = document.getElementById('aboutBox');
    el.footerNote = document.getElementById('footerNote');
    el.schoolName = document.getElementById('schoolName');
    el.appName = document.getElementById('appName');
    el.appTagline = document.getElementById('appTagline');
  }

  function showError(err) {
    el.error.hidden = false;
    el.error.innerHTML =
      '数据加载失败：' + esc(err && err.message ? err.message : err) + '<br>' +
      '如果是双击 HTML 直接打开的，浏览器会拦截本地 JSON 读取。请运行 <code>start.bat</code>，' +
      '或执行 <code>python -m http.server 8000</code> 后访问 <code>http://localhost:8000/</code>。';
  }

  function loadAll() {
    var paths = {
      config: 'data/config.json',
      qa: 'data/qa.json',
      sources: 'data/sources.json',
      rules: 'data/rules.json',
      checklists: 'data/checklists.json'
    };
    var keys = Object.keys(paths);

    return Promise.all(keys.map(function (key) {
      return fetch(paths[key]).then(function (res) {
        if (!res.ok) throw new Error(paths[key] + ' 返回 ' + res.status);
        return res.json();
      });
    })).then(function (results) {
      keys.forEach(function (key, i) { DATA[key] = results[i]; });
      return true;
    }).catch(function (err) {
      showError(err);
      return false;
    });
  }

  /* ---------- 视图切换 ---------- */

  function setView(name) {
    if (VIEWS.indexOf(name) === -1) name = 'qa';
    state.view = name;

    VIEWS.forEach(function (v) {
      var section = document.getElementById('view-' + v);
      if (section) section.classList.toggle('is-active', v === name);
    });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (tab) {
      var active = tab.getAttribute('data-view') === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    if (window.location.hash !== '#' + name) {
      window.history.replaceState(null, '', '#' + name);
    }
    window.scrollTo({ top: 0 });
  }

  /* ---------- 问答 ---------- */

  function domainItems() {
    return (DATA.qa.items || []).filter(function (item) {
      return item.domain === state.domain;
    });
  }

  function categoriesOf(items) {
    var seen = [];
    items.forEach(function (item) {
      if (item.category && seen.indexOf(item.category) === -1) seen.push(item.category);
    });
    return seen;
  }

  function filteredItems() {
    var q = state.q.trim().toLowerCase();
    return domainItems().filter(function (item) {
      if (state.category !== 'all' && item.category !== state.category) return false;
      if (!q) return true;
      if (String(item.question || '').toLowerCase().indexOf(q) !== -1) return true;
      return (item.keywords || []).some(function (kw) {
        return String(kw).toLowerCase().indexOf(q) !== -1;
      });
    });
  }

  function sourceTags(ids) {
    return (ids || []).map(function (id) {
      var src = (DATA.sources.sources || []).filter(function (s) { return s.id === id; })[0];
      if (!src) return '<span class="src">来源待补（' + esc(id) + '）</span>';
      var label = esc(src.name) + ' · ' + esc(src.publisher) + ' · ' + esc(src.effective_date);
      var url = safeUrl(src.url);
      if (url) {
        return '<a class="src" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + label + '</a>';
      }
      return '<span class="src">' + label + '</span>';
    }).join('');
  }

  function renderDomainTabs() {
    Array.prototype.forEach.call(el.domainTabs.querySelectorAll('.field'), function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-domain') === state.domain);
    });
  }

  function renderCategories() {
    var cats = categoriesOf(domainItems());
    var html = '<button class="chip' + (state.category === 'all' ? ' is-active' : '') + '" data-category="all">全部</button>';
    html += cats.map(function (cat) {
      var active = state.category === cat ? ' is-active' : '';
      return '<button class="chip' + active + '" data-category="' + esc(cat) + '">' + esc(cat) + '</button>';
    }).join('');
    el.categoryChips.innerHTML = html;
  }

  function renderQaList() {
    var items = filteredItems();
    var total = domainItems().length;

    if (!items.length) {
      el.qaList.innerHTML = '<p class="empty">没有匹配的问答。换个关键词，或切换到另一个领域看看。</p>';
    } else {
      el.qaList.innerHTML = items.map(function (item) {
        var sample = item.sample ? '<span class="tag tag-sample">示例数据</span>' : '';
        return '<details class="card qa-card">' +
          '<summary>' +
            '<span class="qa-q">' + esc(item.question) + '</span>' +
            '<span class="tag-line"><span class="tag">' + esc(item.category) + '</span>' + sample + '</span>' +
          '</summary>' +
          '<div class="qa-body">' +
            '<p class="qa-answer">' + esc(item.answer) + '</p>' +
            '<dl class="meta-list">' +
              '<div><dt>生效时间</dt><dd>' + esc(item.effective_date) + '</dd></div>' +
              '<div><dt>适用人群</dt><dd>' + esc(item.audience || '全部') + '</dd></div>' +
            '</dl>' +
            '<div class="src-list"><span class="src-label">来源</span>' + sourceTags(item.source_ids) + '</div>' +
          '</div>' +
        '</details>';
      }).join('');
    }

    var meta = '显示 ' + items.length + ' 条 / 共 ' + total + ' 条';
    if (state.q.trim()) meta += ' · 关键词「' + state.q.trim() + '」';
    el.qaMeta.textContent = meta;
  }

  function renderQa() {
    renderDomainTabs();
    renderCategories();
    renderQaList();
  }

  /* ---------- 合同自检 ---------- */

  function currentChecker() {
    var checkers = DATA.rules.checkers || [];
    var found = checkers.filter(function (c) { return c.id === state.checkerId; })[0];
    return found || checkers[0] || null;
  }

  function answersKey(checkerId) {
    return 'sd1_answers_' + checkerId;
  }

  function renderCheckerTabs() {
    el.checkerTabs.innerHTML = (DATA.rules.checkers || []).map(function (checker) {
      var active = currentChecker() && checker.id === currentChecker().id ? ' is-active' : '';
      return '<button class="chip' + active + '" data-checker="' + esc(checker.id) + '">' + esc(checker.name) + '</button>';
    }).join('');
  }

  function renderCheckForm() {
    var checker = currentChecker();
    if (!checker) {
      el.checkForm.innerHTML = '<p class="empty">暂无检查器数据。</p>';
      el.checkerDesc.textContent = '';
      return;
    }

    state.checkerId = checker.id;
    state.answers = LS.get(answersKey(checker.id), {});
    el.checkerDesc.textContent = checker.desc || '';

    el.checkForm.innerHTML = checker.items.map(function (item, index) {
      var picked = state.answers[item.id];
      function option(value, label) {
        var checked = picked === value ? ' checked' : '';
        return '<label><input type="radio" name="' + esc(item.id) + '" value="' + value + '"' + checked + '><span>' + label + '</span></label>';
      }
      return '<div class="check-item">' +
        '<p class="check-q"><span class="check-no">' + (index + 1) + '.</span>' + esc(item.question) + '</p>' +
        '<div class="segmented" role="radiogroup" aria-label="' + esc(item.question) + '">' +
          option('yes', '是') + option('no', '否') + option('unknown', '不清楚') +
        '</div>' +
      '</div>';
    }).join('');
  }

  function renderChecker() {
    renderCheckerTabs();
    renderCheckForm();
    el.resultBox.hidden = true;
  }

  function evaluate(checker) {
    var answeredCount = 0;
    var unanswered = 0;
    var totalMax = 0;
    var score = 0;
    var risks = [];

    checker.items.forEach(function (item) {
      var answer = state.answers[item.id];
      var weight = WEIGHT[item.risk_if_no] || 1;
      if (!answer) { unanswered += 1; return; }
      answeredCount += 1;
      totalMax += weight;
      if (answer === 'no') {
        score += weight;
        risks.push({ item: item, points: weight, answer: answer });
      } else if (answer === 'unknown') {
        score += weight * 0.5;
        risks.push({ item: item, points: weight * 0.5, answer: answer });
      }
    });

    risks.sort(function (a, b) { return b.points - a.points; });

    return {
      score: score,
      totalMax: totalMax,
      ratio: totalMax ? score / totalMax : 0,
      risks: risks,
      unanswered: unanswered,
      answered: answeredCount,
      total: checker.items.length
    };
  }

  function levelOf(ratio) {
    if (ratio >= 0.6) return { cls: 'lv-high', text: '高风险' };
    if (ratio >= 0.3) return { cls: 'lv-mid', text: '中风险' };
    if (ratio > 0) return { cls: 'lv-low', text: '低风险' };
    return { cls: 'lv-none', text: '未见明显风险' };
  }

  function riskBadge(item) {
    var key = item.risk_if_no;
    var cls = key === 'high' ? 'lv-high' : key === 'medium' ? 'lv-mid' : 'lv-low';
    return '<span class="badge ' + cls + '">' + (RISK_LABEL[key] || '低') + '</span>';
  }

  function renderResult() {
    var checker = currentChecker();
    if (!checker) return;

    var result = evaluate(checker);
    if (result.answered === 0) {
      el.resultBox.hidden = false;
      el.resultBox.innerHTML = '<p class="empty">还没有作答。请先对至少一项选择「是 / 否 / 不清楚」。</p>';
      return;
    }

    var level = levelOf(result.ratio);
    var rows = result.risks.map(function (risk) {
      return '<tr>' +
        '<td>' + riskBadge(risk.item) + '</td>' +
        '<td>' + esc(risk.item.question) + '</td>' +
        '<td>' + esc(ANSWER_LABEL[risk.answer]) + '</td>' +
        '<td>' + esc(risk.item.advice) + '</td>' +
      '</tr>';
    }).join('');

    var table = result.risks.length
      ? '<div class="table-wrap"><table class="risk-table">' +
          '<thead><tr><th>风险</th><th>检查项</th><th>你的回答</th><th>建议</th></tr></thead>' +
          '<tbody>' + rows + '</tbody>' +
        '</table></div>'
      : '<p class="empty">已答项均未触发风险规则，仍建议保留合同原件与签字页。</p>';

    var asks = result.risks.slice(0, 3).map(function (risk) {
      return '<li>' + esc(risk.item.advice) + '</li>';
    });
    if (asks.length < 3) {
      asks.push('<li>其余检查项建议逐条对照合同原件核对，口头承诺务必落成文字。</li>');
    }

    var unansweredNote = result.unanswered
      ? ' · 未答 ' + result.unanswered + ' 项（未计入评分）'
      : '';

    el.resultBox.hidden = false;
    el.resultBox.innerHTML =
      '<div class="result-head">' +
        '<span class="badge ' + level.cls + '">' + level.text + '</span>' +
        '<span class="score">风险分 ' + fmt(result.score) + ' / ' + fmt(result.totalMax) + '</span>' +
      '</div>' +
      '<p class="list-meta">已答 ' + result.answered + ' / ' + result.total + unansweredNote + '</p>' +
      table +
      '<h3>签前必问 3 个问题</h3>' +
      '<ol class="ask-list">' + asks.join('') + '</ol>' +
      '<p class="hint">评分规则：否 = 满分，不清楚 = 半分，高 3 / 中 2 / 低 1。结果由本地规则计算，仅供参考。</p>';
  }

  /* ---------- 办事清单 ---------- */

  function currentChecklist() {
    var list = DATA.checklists.checklists || [];
    var found = list.filter(function (c) { return c.id === state.checklistId; })[0];
    return found || list[0] || null;
  }

  function checksKey(id) {
    return 'sd1_cl_' + id;
  }

  function renderChecklistTabs() {
    el.checklistTabs.innerHTML = (DATA.checklists.checklists || []).map(function (list) {
      var active = currentChecklist() && list.id === currentChecklist().id ? ' is-active' : '';
      return '<button class="chip' + active + '" data-checklist="' + esc(list.id) + '">' + esc(list.name) + '</button>';
    }).join('');
  }

  function renderChecklist() {
    renderChecklistTabs();
    var list = currentChecklist();
    if (!list) {
      el.clSteps.innerHTML = '';
      el.clDesc.textContent = '';
      el.clMeta.textContent = '';
      return;
    }

    state.checklistId = list.id;
    var done = LS.get(checksKey(list.id), []);
    el.clDesc.textContent = list.desc || '';

    el.clSteps.innerHTML = list.steps.map(function (step) {
      var checked = done.indexOf(step.id) !== -1;
      var tip = step.tip ? '<p class="step-tip">' + esc(step.tip) + '</p>' : '';
      return '<li class="step' + (checked ? ' is-done' : '') + '">' +
        '<input type="checkbox" id="' + esc(step.id) + '" data-step="' + esc(step.id) + '"' + (checked ? ' checked' : '') + '>' +
        '<div class="step-body">' +
          '<label class="step-text" for="' + esc(step.id) + '">' + esc(step.text) + '</label>' +
          tip +
        '</div>' +
      '</li>';
    }).join('');

    updateChecklistProgress();
  }

  function updateChecklistProgress() {
    var list = currentChecklist();
    if (!list) return;
    var done = LS.get(checksKey(list.id), []);
    var total = list.steps.length;
    var count = list.steps.filter(function (s) { return done.indexOf(s.id) !== -1; }).length;
    el.clBar.style.width = (total ? (count / total) * 100 : 0) + '%';
    el.clMeta.textContent = '已完成 ' + count + ' / ' + total + ' 步';
  }

  /* ---------- 关于 ---------- */

  function renderAbout() {
    var config = DATA.config;
    var qaCount = (DATA.qa.items || []).length;
    var checkerCount = (DATA.rules.checkers || []).length;
    var listCount = (DATA.checklists.checklists || []).length;
    var model = config.model || {};

    el.aboutBox.innerHTML =
      '<div class="about-card">' +
        '<h2>' + esc(config.appName) + '</h2>' +
        '<p>' + esc(config.tagline) + ' · 样例校：' + esc(config.school) + '</p>' +
        '<p>面向大学生（大一至毕业 3 年内）的就业与生活辅导应用，覆盖求职签约、租房安居、医保社保、征信金融、维权求助、心理适应六个场景。核心能力是签约前的合同 / 协议自检。</p>' +
        '<p class="about-meta">版本 ' + esc(config.version) + ' · 数据更新 ' + esc(config.updatedAt) + '</p>' +
      '</div>' +
      '<div class="about-card">' +
        '<h2>当前数据</h2>' +
        '<ul>' +
          '<li>问答 ' + qaCount + ' 条（目标 36 条，内容补充中）</li>' +
          '<li>合同检查器 ' + checkerCount + ' 个</li>' +
          '<li>办事清单 ' + listCount + ' 个</li>' +
        '</ul>' +
      '</div>' +
      '<div class="about-card">' +
        '<h2>模型与离线</h2>' +
        '<p>状态：' + (model.enabled ? '已启用（接口待确认）' : '未启用，全部判断在浏览器本地完成') + '。</p>' +
        '<p>没有模型时不发起任何网络请求，断网也能完整演示。所有数据来自 <code>data/</code> 下的 JSON 文件。</p>' +
      '</div>' +
      '<div class="about-card">' +
        '<h2>免责声明</h2>' +
        '<p>' + esc(config.disclaimer) + '</p>' +
        '<p class="about-meta">标注「示例数据」的条目为占位内容，正式版由内容团队替换。</p>' +
      '</div>';
  }

  /* ---------- 事件 ---------- */

  function bindEvents() {
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (tab) {
      tab.addEventListener('click', function () {
        setView(tab.getAttribute('data-view'));
      });
    });

    el.domainTabs.addEventListener('click', function (event) {
      var btn = event.target.closest('.field');
      if (!btn) return;
      state.domain = btn.getAttribute('data-domain');
      state.category = 'all';
      state.q = '';
      el.qaSearch.value = '';
      renderQa();
    });

    el.categoryChips.addEventListener('click', function (event) {
      var chip = event.target.closest('.chip');
      if (!chip) return;
      state.category = chip.getAttribute('data-category');
      renderCategories();
      renderQaList();
    });

    el.qaSearch.addEventListener('input', function () {
      state.q = el.qaSearch.value;
      if (state.q.trim() && state.category !== 'all') {
        state.category = 'all';
        renderCategories();
      }
      renderQaList();
    });

    el.checkerTabs.addEventListener('click', function (event) {
      var chip = event.target.closest('.chip');
      if (!chip) return;
      state.checkerId = chip.getAttribute('data-checker');
      renderChecker();
    });

    el.checkForm.addEventListener('change', function (event) {
      var input = event.target;
      if (!input.matches('input[type="radio"]')) return;
      state.answers[input.name] = input.value;
      LS.set(answersKey(state.checkerId), state.answers);
    });

    document.getElementById('btnScore').addEventListener('click', renderResult);

    document.getElementById('btnReset').addEventListener('click', function () {
      state.answers = {};
      LS.remove(answersKey(state.checkerId));
      renderCheckForm();
      el.resultBox.hidden = true;
      el.resultBox.innerHTML = '';
    });

    el.checklistTabs.addEventListener('click', function (event) {
      var chip = event.target.closest('.chip');
      if (!chip) return;
      state.checklistId = chip.getAttribute('data-checklist');
      renderChecklist();
    });

    el.clSteps.addEventListener('change', function (event) {
      var input = event.target;
      if (!input.matches('input[type="checkbox"]')) return;
      var list = currentChecklist();
      if (!list) return;
      var done = LS.get(checksKey(list.id), []);
      var id = input.getAttribute('data-step');
      var index = done.indexOf(id);
      if (input.checked && index === -1) done.push(id);
      if (!input.checked && index !== -1) done.splice(index, 1);
      LS.set(checksKey(list.id), done);
      input.closest('.step').classList.toggle('is-done', input.checked);
      updateChecklistProgress();
    });

    document.getElementById('clReset').addEventListener('click', function () {
      var list = currentChecklist();
      if (!list) return;
      LS.remove(checksKey(list.id));
      renderChecklist();
    });
  }

  function applyConfig() {
    var config = DATA.config;
    el.appName.textContent = config.appName || '社会第一课';
    el.appTagline.textContent = config.tagline || '';
    el.schoolName.textContent = config.school || '';
    el.footerNote.textContent = '版本 ' + config.version + ' · ' + (config.disclaimer || '仅供参考，不构成法律意见。');
    document.title = (config.appName || '社会第一课') + ' · 就业与生活辅导';
  }

  function init() {
    cacheEls();
    bindEvents();

    var hash = window.location.hash.replace('#', '');
    setView(VIEWS.indexOf(hash) !== -1 ? hash : 'qa');

    loadAll().then(function (ok) {
      if (!ok) return;
      applyConfig();
      renderQa();
      state.checkerId = (DATA.rules.checkers[0] || {}).id || null;
      renderChecker();
      state.checklistId = (DATA.checklists.checklists[0] || {}).id || null;
      renderChecklist();
      renderAbout();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();