/**
 * サイトマップジェネレーター — XMLサイトマップ機能
 * xml-sitemap.js
 *
 * 【機能】
 *   - 設定タブに「ベースURL」フィールドと「URLスラッグ」設定欄を追加
 *   - ヘッダー／モバイル設定タブに「XML出力」ボタンを追加
 *   - sitemap.xml を生成してブラウザからダウンロード
 */
(function () {
  'use strict';

  // ============================================================
  // 定数・状態
  // ============================================================

  const XML_STORE_KEY  = 'sg_ext_v1';
  const SITE_STORE_KEY = 'sg_v1';

  /** XMLサイトマップ設定ストア */
  let xmlData = {
    baseUrl : '',
    slugs   : {}   // { [pageId]: string }
  };

  // ============================================================
  // ストレージ
  // ============================================================

  function loadXml() {
    try {
      const raw = localStorage.getItem(XML_STORE_KEY);
      if (raw) Object.assign(xmlData, JSON.parse(raw));
    } catch (_) {}
  }

  function saveXml() {
    try { localStorage.setItem(XML_STORE_KEY, JSON.stringify(xmlData)); } catch (_) {}
  }

  /** admin.html 側のサイトデータを localStorage から取得 */
  function getSiteData() {
    try {
      const raw = localStorage.getItem(SITE_STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) { return null; }
  }

  // ============================================================
  // スラッグ自動生成
  // ============================================================

  /**
   * ページ名からURLスラッグを自動生成する。
   * ラテン文字が含まれていればそれを使用し、
   * 日本語のみの場合は連番フォールバック (page-N)。
   */
  function autoSlug(name, n) {
    const latin = (name || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-{2,}/g, '-')
      .replace(/^-|-$/g, '');
    return latin || `page-${n}`;
  }

  // ============================================================
  // XML生成
  // ============================================================

  /**
   * ページツリーを再帰的に走査してサイトマップエントリを構築する。
   * @param {Array}  pages      - ページ配列
   * @param {string} parentPath - 親の絶対パス (例: "/about/")
   * @param {number} depth      - 現在の深さ (0 = ルート)
   * @param {{n:number}} counter - 連番カウンター（参照渡し）
   * @param {Array}  entries    - 結果エントリを追加する配列
   */
  function buildEntries(pages, parentPath, depth, counter, entries) {
    pages.forEach(function (p) {
      counter.n++;

      // ユーザー設定スラッグ → なければ自動生成
      const userSlug = (xmlData.slugs[p.id] || '').trim().replace(/^\/+|\/+$/g, '');

      // ルート階層 (depth=0) でスラッグ未設定かつ TOP/Home 系ページ名の場合、
      // https://example.com/ は既出のためエントリをスキップし、
      // 子ページの親パスも / を引き継ぐ
      const isTopName = /^(top|トップ|トップページ|home|ホーム)$/i.test((p.name || '').trim());
      const skipEntry = depth === 0 && !userSlug && isTopName;

      const slug = skipEntry ? '' : (userSlug || autoSlug(p.name, counter.n));
      const path = skipEntry ? parentPath : parentPath + slug + '/';

      if (!skipEntry) {
        // 深さに応じて priority を下げる (ルート: 1.0, 1段: 0.8, ...)
        const priority = Math.max(0.3, 1.0 - depth * 0.2).toFixed(1);
        entries.push({ path: path, priority: priority });
      }

      if (p.children && p.children.length) {
        buildEntries(p.children, path, depth + 1, counter, entries);
      }
    });
  }

  /**
   * sitemap.xml 文字列を生成して返す。
   * 問題があれば null を返す（アラートも表示）。
   */
  function generateXML() {
    const siteData = getSiteData();

    if (!siteData || !siteData.pages || !siteData.pages.length) {
      alert('ページデータがありません。先にページを追加してください。');
      return null;
    }

    const base = (xmlData.baseUrl || '').replace(/\/+$/, '');
    if (!base) {
      alert('ベースURLを入力してください（例：https://example.com）');
      const el = document.getElementById('sg-ext-base-url');
      if (el) { el.focus(); el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      return null;
    }

    const today   = new Date().toISOString().split('T')[0];
    const counter = { n: 0 };
    const entries = [];

    // ホームページ ( / ) を最初に追加
    entries.push({ path: '/', priority: '1.0' });

    buildEntries(siteData.pages, '/', 0, counter, entries);

    const urlNodes = entries.map(function (e) {
      return [
        '  <url>',
        '    <loc>'      + base + e.path + '</loc>',
        '    <lastmod>'  + today         + '</lastmod>',
        '    <priority>' + e.priority    + '</priority>',
        '  </url>'
      ].join('\n');
    }).join('\n');

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      urlNodes,
      '</urlset>'
    ].join('\n');
  }

  /** XMLをダウンロードする */
  function downloadXML() {
    const xml = generateXML();
    if (!xml) return;

    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'sitemap.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============================================================
  // スラッグ設定UI
  // ============================================================

  /** ページツリーをフラットな配列に変換（UI描画用） */
  function flattenForUI(pages, depth, out) {
    pages.forEach(function (p) {
      out.push({ id: p.id, name: p.name, depth: depth });
      if (p.children && p.children.length) {
        flattenForUI(p.children, depth + 1, out);
      }
    });
  }

  /** スラッグ設定グリッドを再描画 */
  function refreshSlugGrid() {
    const grid = document.getElementById('sg-ext-slug-grid');
    if (!grid) return;

    const siteData = getSiteData();
    if (!siteData || !siteData.pages || !siteData.pages.length) {
      grid.innerHTML =
        '<p style="font-size:12px;color:var(--gray-400);margin-top:4px">' +
        'ページを追加するとここに設定欄が表示されます。</p>';
      return;
    }

    const flat = [];
    flattenForUI(siteData.pages, 0, flat);

    grid.innerHTML = flat.map(function (p, i) {
      const indent = '\u3000'.repeat(p.depth);   // 全角スペースでインデント
      const slug   = xmlData.slugs[p.id] || '';
      const ph     = autoSlug(p.name, i + 1);
      const safeN  = p.name.replace(/"/g, '&quot;');
      return (
        '<div class="sg-ext-slug-row">' +
          '<span class="sg-ext-slug-label" title="' + safeN + '">' + indent + p.name + '</span>' +
          '<input class="sg-ext-slug-input" type="text"' +
            ' placeholder="' + ph + '"' +
            ' value="' + slug + '"' +
            ' data-pid="' + p.id + '"' +
            ' oninput="window.__sgExtSlugInput(this)">' +
        '</div>'
      );
    }).join('');
  }

  // グローバルハンドラ（oninput から参照）
  window.__sgExtSlugInput = function (el) {
    xmlData.slugs[el.dataset.pid] = el.value.trim().replace(/^\/+|\/+$/g, '');
    saveXml();
  };

  window.__sgExtBaseUrlInput = function (val) {
    xmlData.baseUrl = val.trim();
    saveXml();
  };

  // ============================================================
  // CSS 注入
  // ============================================================

  function injectCSS() {
    const style = document.createElement('style');
    style.id = 'sg-ext-style';
    style.textContent = [
      /* セクション */
      '.sg-ext-section{margin-bottom:20px;padding-top:16px;border-top:1px solid var(--gray-100)}',
      '.sg-ext-section-title{font-size:11px;font-weight:700;color:var(--gray-400);text-transform:uppercase;letter-spacing:.08em;margin-bottom:10px}',
      /* テキスト入力 */
      '.sg-ext-input{width:100%;padding:8px 10px;border:1px solid var(--gray-200);border-radius:var(--radius);font-size:13px;outline:none;transition:border-color .15s;color:var(--gray-900);background:var(--white);font-family:inherit}',
      '.sg-ext-input:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(79,70,229,.08)}',
      /* ボタン */
      '.sg-ext-btn{display:inline-flex;align-items:center;gap:5px;padding:7px 14px;border:1px solid var(--gray-200);border-radius:var(--radius);font-size:13px;font-weight:500;cursor:pointer;transition:all .15s;background:var(--white);color:var(--gray-600);white-space:nowrap;font-family:inherit}',
      '.sg-ext-btn:hover{background:var(--gray-100)}',
      /* スラッグリスト */
      '.sg-ext-slug-list{display:flex;flex-direction:column;gap:6px;margin-top:8px;max-height:260px;overflow-y:auto;border:1px solid var(--gray-200);border-radius:var(--radius);padding:8px;background:var(--gray-50)}',
      '.sg-ext-slug-row{display:flex;align-items:center;gap:8px}',
      '.sg-ext-slug-label{font-size:12px;color:var(--gray-600);flex-shrink:0;width:96px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.sg-ext-slug-input{flex:1;min-width:0;padding:5px 8px;border:1px solid var(--gray-200);border-radius:var(--radius);font-size:12px;outline:none;transition:border-color .15s;color:var(--gray-900);background:var(--white);font-family:inherit}',
      '.sg-ext-slug-input:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(79,70,229,.08)}',
      /* ヒントテキスト */
      '.sg-ext-hint{font-size:11px;color:var(--gray-400);margin-top:6px;line-height:1.6}',
      /* スクロールバー */
      '@media (pointer: fine){',
      '.sg-ext-slug-list::-webkit-scrollbar{width:6px}',
      '.sg-ext-slug-list::-webkit-scrollbar-track{background:var(--gray-200);border-radius:3px}',
      '.sg-ext-slug-list::-webkit-scrollbar-thumb{background:var(--gray-400);border-radius:3px}',
      '.sg-ext-slug-list::-webkit-scrollbar-thumb:hover{background:var(--gray-500)}',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  // ============================================================
  // UI 注入 — 設定タブ内セクション
  // ============================================================

  function injectSettingsSection() {
    const noteEl = document.getElementById('f-note');
    if (!noteEl) return;

    const noteSection = noteEl.closest('.form-section');
    if (!noteSection) return;

    // すでに注入済みなら何もしない
    if (document.getElementById('sg-ext-settings')) return;

    const section = document.createElement('div');
    section.className = 'sg-ext-section';
    section.id        = 'sg-ext-settings';
    section.innerHTML =
      '<div class="sg-ext-section-title">🌐 XMLサイトマップ設定</div>' +

      '<div class="form-field">' +
        '<label class="form-label">ベースURL</label>' +
        '<input id="sg-ext-base-url" class="sg-ext-input" type="url"' +
          ' placeholder="https://example.com"' +
          ' value="' + (xmlData.baseUrl || '') + '"' +
          ' oninput="window.__sgExtBaseUrlInput(this.value)">' +
        '<p class="sg-ext-hint">例：https://example.com（末尾スラッシュ不要）</p>' +
      '</div>' +

      '<div class="form-field" style="margin-top:12px">' +
        '<label class="form-label">URLスラッグ（空欄＝自動生成）</label>' +
        '<div class="sg-ext-slug-list" id="sg-ext-slug-grid"></div>' +
        '<p class="sg-ext-hint">各ページのURL末尾スラッグを設定します。<br>' +
        '空欄の場合はページ名のアルファベット部分または連番で自動生成されます。</p>' +
      '</div>';

    // 備考・メモセクションの次の要素の前に挿入
    const nextSibling = noteSection.nextElementSibling;
    if (nextSibling) {
      noteSection.parentNode.insertBefore(section, nextSibling);
    } else {
      noteSection.parentNode.appendChild(section);
    }

    refreshSlugGrid();
  }

  // ============================================================
  // UI 注入 — ヘッダーボタン（PC）
  // ============================================================

  function injectHeaderButton() {
    const actions = document.querySelector('.header-actions');
    if (!actions || document.getElementById('sg-ext-header-btn')) return;

    const btn     = document.createElement('button');
    btn.id        = 'sg-ext-header-btn';
    btn.className = 'btn sg-ext-btn hide-sm';
    btn.title     = 'XMLサイトマップをダウンロード (sitemap.xml)';
    btn.innerHTML = '🗂️ XML出力';
    btn.addEventListener('click', downloadXML);

    // 「ダウンロード」ボタンの直前に挿入
    const primary = actions.querySelector('.btn-primary');
    primary ? actions.insertBefore(btn, primary) : actions.appendChild(btn);
  }

  // ============================================================
  // UI 注入 — モバイル設定タブ内ボタン
  // ============================================================

  function injectMobileButton() {
    const wrap = document.querySelector('.mobile-sub-actions > div');
    if (!wrap || document.getElementById('sg-ext-mobile-btn')) return;

    const btn     = document.createElement('button');
    btn.id        = 'sg-ext-mobile-btn';
    btn.className = 'btn btn-ghost';
    btn.style.cssText = 'flex:1;min-width:120px';
    btn.innerHTML = '🗂️ XML出力';
    btn.addEventListener('click', downloadXML);
    wrap.appendChild(btn);
  }

  // ============================================================
  // renderAll フック
  // （ページ追加・削除・更新でスラッググリッドを自動更新）
  // ============================================================

  function hookRenderAll() {
    const orig = window.renderAll;
    if (typeof orig !== 'function') return;

    window.renderAll = function () {
      orig.apply(this, arguments);
      refreshSlugGrid();
    };
  }

  // ============================================================
  // 初期化
  // ============================================================

  function init() {
    loadXml();
    injectCSS();
    injectHeaderButton();
    injectSettingsSection();
    injectMobileButton();
    hookRenderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
