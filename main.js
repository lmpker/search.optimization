// ==UserScript==
// @name         聚合搜索
// @version      1.6
// @description  快速切换搜索引擎，支持启用/禁用、SVG 图标、拖拽排序
// @author       Never7 (Modified)
// @license      MIT
// @match        *://www.baidu.com/*
// @match        *://www.google.com/*
// @match        *://cn.bing.com/*
// @match        *://duckduckgo.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ----- 常量与配置 -----
    const DEBOUNCE_DELAY = 500;
    const STORAGE_KEY = 'aggregated_search_engines_config_v2'; // 升级 Key 以避免旧数据冲突
    const STORAGE_KEY_MODAL_SIZE = 'aggregated_search_modal_size_v1';

    // 默认搜索引擎列表
    const DEFAULT_ENGINES = [
        {
            name: 'baidu',
            enabled: true,
            icon: 'https://www.google.com/s2/favicons?domain=baidu.com&sz=64',
            url: 'https://www.baidu.com/s?wd=',
            domain: 'baidu.com'
        },
        {
            name: 'google',
            enabled: true,
            icon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64',
            url: 'https://www.google.com/search?q=',
            domain: 'google.com'
        },
        {
            name: 'bing',
            enabled: true,
            icon: 'https://www.google.com/s2/favicons?domain=bing.com&sz=64',
            url: 'https://cn.bing.com/search?q=',
            domain: 'bing.com'
        },
        {
            name: 'github',
            enabled: true,
            icon: 'https://www.google.com/s2/favicons?domain=github.com&sz=64',
            url: 'https://github.com/search?q=',
            domain: 'github.com'
        },
        {
            name: 'yandex',
            enabled: true,
            icon: 'https://www.google.com/s2/favicons?domain=yandex.com&sz=64',
            url: 'https://yandex.com/search/?text=',
            domain: 'yandex.com'
        },
        {
            name: 'duckduckgo',
            enabled: true,
            icon: 'https://www.google.com/s2/favicons?domain=duckduckgo.com&sz=64',
            url: 'https://duckduckgo.com/?q=',
            domain: 'duckduckgo.com'
        },
        {
            name: 'youtube',
            enabled: true,
            icon: 'https://www.google.com/s2/favicons?domain=youtube.com&sz=64',
            url: 'https://www.youtube.com/results?search_query=',
            domain: 'youtube.com'
        },
        {
            name: 'bilibili',
            enabled: true,
            icon: 'https://www.google.com/s2/favicons?domain=bilibili.com&sz=64',
            url: 'https://search.bilibili.com/all?keyword=',
            domain: 'bilibili.com'
        },
        {
            name: 'xiaohongshu',
            enabled: true,
            icon: 'https://www.google.com/s2/favicons?domain=xiaohongshu.com&sz=64',
            url: 'https://www.xiaohongshu.com/search_result?keyword=',
            domain: 'xiaohongshu.com'
        },
        {
            name: 'zhihu',
            enabled: true,
            icon: 'https://www.google.com/s2/favicons?domain=zhihu.com&sz=64',
            url: 'https://www.zhihu.com/search?type=content&q=',
            domain: 'zhihu.com'
        }
    ];

    // ----- 状态管理 -----
    let engines = [];

    // 加载配置
    function loadEngines() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // 数据迁移：确保所有项都有 enabled 属性
                engines = parsed.map(e => ({
                    enabled: typeof e.enabled !== 'undefined' ? e.enabled : true,
                    ...e
                }));
            } catch (e) {
                console.error('配置读取失败，重置为默认', e);
                engines = JSON.parse(JSON.stringify(DEFAULT_ENGINES));
            }
        } else {
            engines = JSON.parse(JSON.stringify(DEFAULT_ENGINES));
        }
    }

    // 保存配置
    function saveEngines() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(engines));
        // 保存后重新渲染主界面
        createSwitcher(true);
    }

    // ----- 工具函数 -----
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    function getURLParams() {
        return new URLSearchParams(window.location.search);
    }

    // 智能转换域名为 Favicon API 地址
    function processIconUrl(input) {
        input = input.trim();
        // 如果不包含 http 且看起来像域名，或者直接就是域名，则通过 API 转换
        if (!input.startsWith('http') && !input.startsWith('data:') && input.includes('.')) {
            return `https://www.google.com/s2/favicons?domain=${input}&sz=64`;
        }
        return input;
    }

    // 获取当前页面对应的搜索引擎对象
    function getCurrentEngineObj() {
        const host = window.location.host.toLowerCase();
        return engines.find(e => host.includes(e.domain || 'NEVER_MATCH')) || null;
    }

    // 获取通用查询参数
    function getCurrentQuery() {
        const params = getURLParams();
        return params.get('wd') || params.get('q') || params.get('keyword') || params.get('query') || params.get('text') || '';
    }

    // 切换引擎
    function switchEngine(engineUrl) {
        const query = getCurrentQuery();
        if (query) {
            let newUrl;
            if (engineUrl.endsWith('=') || engineUrl.endsWith('?')) {
                newUrl = engineUrl + encodeURIComponent(query);
            } else {
                newUrl = engineUrl + encodeURIComponent(query);
            }
            window.location.href = newUrl;
        }
    }

    // ----- UI 构建：设置弹窗 -----
    function openSettings() {
        const oldModal = document.getElementById('search-switcher-settings');
        if (oldModal) oldModal.remove();

        const modal = document.createElement('div');
        modal.id = 'search-switcher-settings';
        
        const shadow = modal.attachShadow({ mode: 'open' });
        
        // 读取记忆的大小
        let savedWidth = '550px';
        let savedHeight = '500px';
        try {
            const savedSize = JSON.parse(localStorage.getItem(STORAGE_KEY_MODAL_SIZE));
            if (savedSize && savedSize.width) savedWidth = savedSize.width;
            if (savedSize && savedSize.height) savedHeight = savedSize.height;
        } catch (e) {}

        const style = document.createElement('style');
        style.textContent = `
            * { box-sizing: border-box; }
            :host {
                position: fixed;
                top: 0; left: 0; width: 100vw; height: 100vh;
                background: rgba(0,0,0,0.4);
                z-index: 10000;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: sans-serif;
            }
            .container {
                background: #fff;
                width: ${savedWidth};
                height: ${savedHeight};
                min-width: 400px;
                min-height: 350px;
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                overflow: hidden;
                resize: both;
                position: relative;
            }
            .header {
                padding: 15px 20px;
                background: #f5f5f5;
                border-bottom: 1px solid #ddd;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: default;
                flex-shrink: 0;
            }
            .header h3 { margin: 0; font-size: 16px; color: #333; }
            .close-btn {
                background: none; border: none; font-size: 24px; cursor: pointer; color: #999;
                line-height: 1; padding: 0 5px;
            }
            .close-btn:hover { color: #333; }
            .body {
                flex: 1;
                overflow-y: auto;
                padding: 10px;
            }
            .row {
                display: flex;
                align-items: center;
                padding: 8px 5px;
                background: #fff;
                border-bottom: 1px solid #eee;
                transition: background 0.2s;
            }
            .row:hover { background: #fafafa; }
            .row.dragging { opacity: 0.5; background: #eef; }
            .row.disabled { opacity: 0.6; background: #f9f9f9; }
            
            .drag-handle {
                cursor: grab;
                font-size: 20px;
                color: #aaa;
                padding: 0 10px;
                user-select: none;
            }
            .drag-handle:active { cursor: grabbing; color: #666; }

            /* 复选框样式 */
            .chk-enable {
                margin: 0 8px 0 0;
                width: 16px; height: 16px;
                cursor: pointer;
            }

            .icon-preview {
                width: 24px; height: 24px; margin-right: 10px; border-radius: 4px; object-fit: cover; flex-shrink: 0;
            }
            .input-group {
                flex: 1; display: flex; gap: 5px;
            }
            input[type="text"] {
                padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;
                width: 100%;
            }
            .input-icon { flex: 1; }
            .input-url { flex: 2; }

            .btn-del {
                background: #ff4d4f; color: #fff; border: none; padding: 5px 10px;
                border-radius: 4px; cursor: pointer; margin-left: 8px; font-size: 12px;
                flex-shrink: 0;
            }
            .btn-del:hover { background: #ff7875; }

            .footer {
                padding: 10px 20px;
                border-top: 1px solid #ddd;
                background: #fff;
                display: flex;
                justify-content: space-between;
                flex-shrink: 0;
            }
            .btn {
                padding: 8px 16px; border-radius: 6px; border: none; cursor: pointer; font-size: 14px;
            }
            .btn-add { background: #52c41a; color: #fff; }
            .btn-add:hover { background: #73d13d; }
            .btn-save { background: #1890ff; color: #fff; }
            .btn-save:hover { background: #40a9ff; }
            .btn-reset { background: #f5f5f5; color: #666; border: 1px solid #ddd; }
            .btn-reset:hover { background: #e8e8e8; }
            
            .body::-webkit-scrollbar { width: 6px; }
            .body::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
        `;

        const container = document.createElement('div');
        container.className = 'container';

        // 头部
        container.innerHTML = `
            <div class="header">
                <h3>搜索引擎设置 (勾选以启用)</h3>
                <button class="close-btn">×</button>
            </div>
            <div class="body" id="list-body"></div>
            <div class="footer">
                <div>
                    <button class="btn btn-add">＋ 新增</button>
                    <button class="btn btn-reset">重置默认</button>
                </div>
                <button class="btn btn-save">保存生效</button>
            </div>
        `;

        const listBody = container.querySelector('#list-body');

        // 渲染列表项
        function renderList() {
            listBody.innerHTML = '';
            engines.forEach((engine, index) => {
                const row = document.createElement('div');
                row.className = `row ${engine.enabled ? '' : 'disabled'}`;
                row.dataset.index = index;
                row.setAttribute('draggable', 'false'); // 默认不可拖动，只有按住 handle 时可拖动

                // HTML 结构
                row.innerHTML = `
                    <div class="drag-handle" title="按住拖动排序">☰</div>
                    <input type="checkbox" class="chk-enable" title="启用/禁用" ${engine.enabled ? 'checked' : ''}>
                    <img src="${engine.icon}" class="icon-preview" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiNjY2MiLz48L3N2Zz4='">
                    <div class="input-group">
                        <input type="text" class="input-icon" value="${engine.icon}" placeholder="图标链接或域名">
                        <input type="text" class="input-url" value="${engine.url}" placeholder="搜索URL">
                    </div>
                    <button class="btn-del">删除</button>
                `;

                // --- 启用/禁用逻辑 ---
                const checkbox = row.querySelector('.chk-enable');
                checkbox.addEventListener('change', (e) => {
                    engine.enabled = e.target.checked;
                    if (engine.enabled) {
                        row.classList.remove('disabled');
                    } else {
                        row.classList.add('disabled');
                    }
                });

                // --- 拖动排序逻辑 ---
                const handle = row.querySelector('.drag-handle');
                handle.addEventListener('mousedown', () => row.setAttribute('draggable', 'true'));
                row.addEventListener('mouseup', () => row.setAttribute('draggable', 'false'));
                
                row.addEventListener('dragstart', (e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', index);
                    row.classList.add('dragging');
                    setTimeout(() => row.style.display = 'none', 0);
                });

                row.addEventListener('dragend', () => {
                    row.style.display = 'flex';
                    row.classList.remove('dragging');
                    row.setAttribute('draggable', 'false');
                    [...listBody.children].forEach(child => child.style.borderTop = '');
                });

                row.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    row.style.borderTop = '2px solid #1890ff';
                });

                row.addEventListener('dragleave', () => {
                    row.style.borderTop = '';
                });

                row.addEventListener('drop', (e) => {
                    e.preventDefault();
                    row.style.borderTop = '';
                    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
                    const toIndex = index;
                    if (fromIndex !== toIndex) {
                        const movedItem = engines.splice(fromIndex, 1)[0];
                        engines.splice(toIndex, 0, movedItem);
                        renderList();
                    }
                });

                // --- 输入框逻辑 ---
                const inputIcon = row.querySelector('.input-icon');
                inputIcon.addEventListener('change', (e) => {
                    const newVal = processIconUrl(e.target.value);
                    engine.icon = newVal;
                    if (newVal !== e.target.value) e.target.value = newVal;
                    row.querySelector('.icon-preview').src = newVal;
                });
                inputIcon.addEventListener('mousedown', e => e.stopPropagation());

                const inputUrl = row.querySelector('.input-url');
                inputUrl.addEventListener('change', (e) => {
                    engine.url = e.target.value;
                });
                inputUrl.addEventListener('mousedown', e => e.stopPropagation());

                // --- 删除逻辑 ---
                row.querySelector('.btn-del').addEventListener('click', () => {
                    if (confirm('确定删除这个搜索引擎吗？')) {
                        engines.splice(index, 1);
                        renderList();
                    }
                });

                listBody.appendChild(row);
            });
        }

        renderList();

        // 监听容器大小变化
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (container._saveTimeout) clearTimeout(container._saveTimeout);
                container._saveTimeout = setTimeout(() => {
                    const rect = container.getBoundingClientRect();
                    localStorage.setItem(STORAGE_KEY_MODAL_SIZE, JSON.stringify({
                        width: rect.width + 'px',
                        height: rect.height + 'px'
                    }));
                }, 500);
            }
        });
        resizeObserver.observe(container);

        const closeModal = () => {
            resizeObserver.disconnect();
            modal.remove();
        };

        container.querySelector('.close-btn').addEventListener('click', closeModal);
        container.querySelector('.btn-add').addEventListener('click', () => {
            engines.push({
                name: 'custom',
                enabled: true,
                icon: 'https://www.google.com/s2/favicons?domain=example.com&sz=64',
                url: '',
                domain: ''
            });
            renderList();
            setTimeout(() => listBody.scrollTop = listBody.scrollHeight, 10);
        });
        container.querySelector('.btn-reset').addEventListener('click', () => {
            if (confirm('确定恢复默认设置吗？所有自定义将丢失。')) {
                engines = JSON.parse(JSON.stringify(DEFAULT_ENGINES));
                renderList();
            }
        });
        container.querySelector('.btn-save').addEventListener('click', () => {
            saveEngines();
            closeModal();
        });
        
        modal.addEventListener('click', (e) => {
            if (e.composedPath()[0] === modal) closeModal();
        });

        shadow.appendChild(style);
        shadow.appendChild(container);
        document.body.appendChild(modal);
    }

    // ----- UI 构建：主切换器 -----
    function createSwitcher(forceUpdate = false) {
        let container = document.getElementById('search-switcher-container');
        if (container && forceUpdate) {
            container.remove();
            container = null;
        }
        
        if (container && container.isConnected) return;

        container = document.createElement('div');
        container.id = 'search-switcher-container';

        const shadow = container.attachShadow({ mode: 'open' });
        shadow.innerHTML = `
            <style>
                #search-switcher {
                    position: fixed;
                    left: -10px;
                    top: 50%;
                    transform: translateY(-50%);
                    z-index: 9999;
                    padding: 8px 8px 8px 10px;
                    background: rgba(255, 255, 255, 0.8);
                    backdrop-filter: blur(10px);
                    border-radius: 0 12px 12px 0;
                    box-shadow: 2px 0 15px rgba(0,0,0,0.08);
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }
                .icon {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 38px;
                    height: 38px;
                    cursor: pointer;
                    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
                    border-radius: 10px;
                    background-color: rgba(255, 255, 255, 0.7);
                    border: none;
                    padding: 0;
                }
                .icon:hover {
                    transform: scale(1.15);
                    background-color: #fff;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                    opacity: 1;
                }
                .icon img {
                    width: 20px;
                    height: 20px;
                    opacity: 0.8;
                    border-radius: 4px;
                    transition: all 0.2s;
                    object-fit: cover;
                }
                .icon:hover img { opacity: 1; width: 24px; height: 24px; }
                
                .setting-icon svg {
                    width: 20px; height: 20px; fill: #666; transition: transform 0.5s;
                }
                .setting-icon:hover svg {
                    transform: rotate(90deg); fill: #333;
                }
            </style>
            <div id="search-switcher"></div>
        `;

        const switcher = shadow.getElementById('search-switcher');
        const frag = document.createDocumentFragment();

        // 1. 设置按钮
        const settingBtn = document.createElement('button');
        settingBtn.className = 'icon setting-icon';
        settingBtn.title = '设置';
        settingBtn.innerHTML = `
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.488.488 0 0 0-.59.22L2.05 8.87a.49.49 0 0 0 .12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.58 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/>
            </svg>
        `;
        settingBtn.addEventListener('click', openSettings);
        frag.appendChild(settingBtn);

        // 2. 添加引擎图标 (只添加 enabled: true 的)
        engines.filter(e => e.enabled).forEach(engine => {
            const button = document.createElement('button');
            button.className = 'icon';
            button.title = `切换到 ${engine.name || 'Search'}`;
            
            const img = document.createElement('img');
            img.src = engine.icon;
            img.onerror = function() {
                this.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiNjY2MiLz48L3N2Zz4=';
            };
            
            button.appendChild(img);
            button.addEventListener('click', () => switchEngine(engine.url));
            frag.appendChild(button);
        });

        switcher.appendChild(frag);
        document.body.appendChild(container);
    }

    // ----- 初始化 -----
    function init() {
        loadEngines();
        createSwitcher();

        if (getCurrentEngineObj()?.name === 'baidu') {
            const debouncedCheck = debounce(() => {
                const container = document.getElementById('search-switcher-container');
                if (!container || !container.isConnected) {
                    createSwitcher();
                }
            }, DEBOUNCE_DELAY);

            const observer = new MutationObserver(debouncedCheck);
            observer.observe(document.documentElement, { childList: true, subtree: true });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
