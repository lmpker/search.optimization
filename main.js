// ==UserScript==
// @name         聚合搜索
// @version      1.5
// @description  快速切换搜索引擎，支持 SVG 和图片图标，新增头条、抖音
// @author       Never7 (Modified)
// @license      MIT
// @match        *://www.baidu.com/s*
// @match        *://www.google.com/*
// @match        *://*.bing.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // ----- 常量与配置 -----
    const DEBOUNCE_DELAY = 500;
    const STORAGE_KEY = 'aggregated_search_engines_config_v1';
    const STORAGE_KEY_MODAL_SIZE = 'aggregated_search_modal_size_v1'; // 新增：记忆弹窗大小的 Key

    // 默认搜索引擎列表 (全部使用 Google Favicon API)
    const DEFAULT_ENGINES = [
        {
            name: 'baidu',
            icon: 'https://www.google.com/s2/favicons?domain=baidu.com&sz=64',
            url: 'https://www.baidu.com/s?wd=',
            domain: 'baidu.com'
        },
        {
            name: 'google',
            icon: 'https://www.google.com/s2/favicons?domain=google.com&sz=64',
            url: 'https://www.google.com/search?q=',
            domain: 'google.com'
        },
        {
            name: 'bing',
            icon: 'https://www.google.com/s2/favicons?domain=bing.com&sz=64',
            url: 'https://cn.bing.com/search?q=',
            domain: 'bing.com'
        },
        {
            name: 'zhihu',
            icon: 'https://www.google.com/s2/favicons?domain=zhihu.com&sz=64',
            url: 'https://www.zhihu.com/search?type=content&q=',
            domain: 'zhihu.com'
        },
        {
            name: 'bilibili',
            icon: 'https://www.google.com/s2/favicons?domain=bilibili.com&sz=64',
            url: 'https://search.bilibili.com/all?keyword=',
            domain: 'bilibili.com'
        },
        {
            name: 'toutiao',
            icon: 'https://www.google.com/s2/favicons?domain=toutiao.com&sz=64',
            url: 'https://so.toutiao.com/search?keyword=',
            domain: 'toutiao.com'
        },
        {
            name: 'douyin',
            icon: 'https://www.google.com/s2/favicons?domain=douyin.com&sz=64',
            url: 'https://www.douyin.com/search/',
            domain: 'douyin.com'
        }
    ];

    // ----- 状态管理 -----
    let engines = [];

    // 加载配置
    function loadEngines() {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                engines = JSON.parse(saved);
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
        // 优先完全匹配，再尝试包含匹配
        return engines.find(e => host.includes(e.domain || 'NEVER_MATCH')) || null;
    }

    // 获取通用查询参数
    function getCurrentQuery() {
        // 尝试获取当前页面的查询词
        const params = getURLParams();
        return params.get('wd') || params.get('q') || params.get('keyword') || params.get('query') || '';
    }

    // 切换引擎
    function switchEngine(engineUrl) {
        const query = getCurrentQuery();
        if (query) {
            let newUrl;
            if (engineUrl.endsWith('=') || engineUrl.endsWith('?')) {
                newUrl = engineUrl + encodeURIComponent(query);
            } else {
                // 简单的判断，如果没有 = 结尾，尝试直接拼接
                newUrl = engineUrl + encodeURIComponent(query);
            }
            window.location.href = newUrl;
        }
    }

    // ----- UI 构建：设置弹窗 -----
    function openSettings() {
        // 如果已存在则移除
        const oldModal = document.getElementById('search-switcher-settings');
        if (oldModal) oldModal.remove();

        const modal = document.createElement('div');
        modal.id = 'search-switcher-settings';
        
        // Shadow DOM 隔离样式
        const shadow = modal.attachShadow({ mode: 'open' });
        
        // 读取记忆的大小
        let savedWidth = '500px';
        let savedHeight = '400px';
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
                width: ${savedWidth};   /* 应用记忆的宽度 */
                height: ${savedHeight}; /* 应用记忆的高度 */
                min-width: 350px;
                min-height: 300px;
                border-radius: 12px;
                display: flex;
                flex-direction: column;
                box-shadow: 0 10px 25px rgba(0,0,0,0.2);
                overflow: hidden;
                resize: both; /* 允许拖动右下角缩放 */
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
            
            /* 拖动句柄 */
            .drag-handle {
                cursor: grab;
                font-size: 20px;
                color: #aaa;
                padding: 0 10px;
                user-select: none;
            }
            .drag-handle:active { cursor: grabbing; color: #666; }

            .icon-preview {
                width: 24px; height: 24px; margin-right: 10px; border-radius: 4px; object-fit: cover; flex-shrink: 0;
            }
            .input-group {
                flex: 1; display: flex; gap: 5px;
            }
            input {
                padding: 6px; border: 1px solid #ddd; border-radius: 4px; font-size: 13px;
                width: 100%;
            }
            /* 输入框比例 */
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
            
            /* 滚动条美化 */
            .body::-webkit-scrollbar { width: 6px; }
            .body::-webkit-scrollbar-thumb { background: #ccc; border-radius: 3px; }
        `;

        const container = document.createElement('div');
        container.className = 'container';

        // 头部
        container.innerHTML = `
            <div class="header">
                <h3>搜索引擎设置</h3>
                <button class="close-btn">×</button>
            </div>
            <div class="body" id="list-body"></div>
            <div class="footer">
                <div>
                    <button class="btn btn-add">＋ 新增</button>
                    <button class="btn btn-reset">重置默认</button>
                </div>
                <button class="btn btn-save">保存</button>
            </div>
        `;

        const listBody = container.querySelector('#list-body');

        // 渲染列表项
        function renderList() {
            listBody.innerHTML = '';
            engines.forEach((engine, index) => {
                const row = document.createElement('div');
                row.className = 'row';
                row.dataset.index = index;
                // HTML 结构：拖动句柄 | 图标预览 | 图标链接输入 | 搜索链接输入 | 删除
                row.innerHTML = `
                    <div class="drag-handle" title="按住拖动排序">☰</div>
                    <img src="${engine.icon}" class="icon-preview" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiNjY2MiLz48L3N2Zz4='">
                    <div class="input-group">
                        <input type="text" class="input-icon" value="${engine.icon}" placeholder="图标链接或域名(如 baidu.com)">
                        <input type="text" class="input-url" value="${engine.url}" placeholder="搜索URL(如 https://.../s?q=)">
                    </div>
                    <button class="btn-del">删除</button>
                `;

                // --- 拖动排序逻辑 ---
                const handle = row.querySelector('.drag-handle');
                
                // 仅当鼠标在 handle 上按下时，才允许该行拖动
                handle.addEventListener('mousedown', () => {
                    row.setAttribute('draggable', 'true');
                });
                
                // 拖动结束或鼠标松开，移除 draggable，防止选中文本时拖动
                row.addEventListener('mouseup', () => row.setAttribute('draggable', 'false'));
                row.addEventListener('dragend', () => {
                    row.setAttribute('draggable', 'false');
                    row.classList.remove('dragging');
                    // 移除所有占位样式
                    [...listBody.children].forEach(child => child.style.borderTop = '');
                });

                row.addEventListener('dragstart', (e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', index);
                    row.classList.add('dragging');
                    setTimeout(() => row.style.display = 'none', 0); // 拖动时隐藏原元素
                });

                row.addEventListener('dragend', () => {
                    row.style.display = 'flex';
                    row.classList.remove('dragging');
                });

                // 放置逻辑
                row.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    // 简单的视觉反馈
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
                        // 移动数组元素
                        const movedItem = engines.splice(fromIndex, 1)[0];
                        engines.splice(toIndex, 0, movedItem);
                        renderList(); // 重新渲染
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
                // 阻止输入框冒泡，确保在输入框操作不会触发拖动（虽然 draggable 逻辑已保护）
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

        // 监听容器大小变化并保存 (防抖)
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                if (container._saveTimeout) clearTimeout(container._saveTimeout);
                container._saveTimeout = setTimeout(() => {
                    const rect = container.getBoundingClientRect();
                    // 保存当前的宽度和高度
                    localStorage.setItem(STORAGE_KEY_MODAL_SIZE, JSON.stringify({
                        width: rect.width + 'px',
                        height: rect.height + 'px'
                    }));
                }, 500);
            }
        });
        resizeObserver.observe(container);

        // 关闭弹窗函数
        const closeModal = () => {
            resizeObserver.disconnect();
            modal.remove();
        };

        // 底部按钮事件
        container.querySelector('.close-btn').addEventListener('click', closeModal);
        container.querySelector('.btn-add').addEventListener('click', () => {
            engines.push({
                name: 'custom',
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
        
        // 点击背景关闭
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
                    width: 20px;   /* 恢复原来的大小 */
                    height: 20px;  /* 恢复原来的大小 */
                    opacity: 0.8;
                    border-radius: 4px;
                    transition: all 0.2s;
                    object-fit: cover;
                }
                .icon:hover img { opacity: 1; width: 24px; height: 24px; } /* 恢复悬停大小 */
                
                /* 设置齿轮图标特殊样式 */
                .setting-icon svg {
                    width: 20px; height: 20px; fill: #666; transition: transform 0.5s; /* 恢复原来的大小 */
                }
                .setting-icon:hover svg {
                    transform: rotate(90deg); fill: #333;
                }
            </style>
            <div id="search-switcher"></div>
        `;

        const switcher = shadow.getElementById('search-switcher');
        const frag = document.createDocumentFragment();

        // 1. 添加设置按钮 (安卓齿轮图标)
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

        // 2. 遍历添加搜索引擎图标
        engines.forEach(engine => {
            const button = document.createElement('button');
            button.className = 'icon';
            button.title = `切换到 ${engine.name || 'Search'}`;
            
            const img = document.createElement('img');
            img.src = engine.icon;
            // 如果图片加载失败，显示默认圆点
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

        // 针对百度等动态页面，使用 MutationObserver 防抖检测
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
