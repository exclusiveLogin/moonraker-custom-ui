/**
 * Web Component для отображения списка G-code файлов
 */
import store from '../services/store.js';
import api from '../services/api-instance.js';

class FilesWidget extends HTMLElement {
    constructor() {
        super();
        this.unsubscribe = null;
        this.api = api; // Используем singleton API
        this.files = [];
    }

    connectedCallback() {
        this.render();
        this.loadFiles();
        this.unsubscribe = store.subscribe((state) => {
            this.updateCurrentFile(state);
        });
    }

    disconnectedCallback() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    render() {
        this.innerHTML = `
            <div class="widget files-widget">
                <div class="widget-header">
                    <span class="widget-title">📁 Файлы</span>
                    <button class="refresh-btn" id="btnRefresh" title="Обновить">🔄</button>
                </div>
                <div class="widget-content">
                    <div class="files-list" id="filesList">
                        <div class="loading">Загрузка...</div>
                    </div>
                </div>
            </div>
        `;

        this.querySelector('#btnRefresh')?.addEventListener('click', () => this.loadFiles());
        this.addStyles();
    }

    async loadFiles() {
        const listEl = this.querySelector('#filesList');
        if (!listEl) return;

        listEl.innerHTML = '<div class="loading">Загрузка...</div>';

        try {
            const response = await this.api.getFiles();
            this.files = response.result || [];
            this.renderFiles();
        } catch (error) {
            console.error('[FilesWidget] Failed to load files:', error);
            listEl.innerHTML = '<div class="error">Ошибка загрузки</div>';
        }
    }

    renderFiles() {
        const listEl = this.querySelector('#filesList');
        if (!listEl) return;

        if (this.files.length === 0) {
            listEl.innerHTML = '<div class="empty">Нет файлов</div>';
            return;
        }

        // Сортируем по дате изменения (новые сверху)
        const sortedFiles = [...this.files]
            .sort((a, b) => (b.modified || 0) - (a.modified || 0))
            .slice(0, 10); // Показываем только 10 последних

        listEl.innerHTML = sortedFiles.map(file => `
            <div class="file-item" data-filename="${file.path || file.filename}">
                <div class="file-info">
                    <span class="file-name">${this.getShortName(file.path || file.filename)}</span>
                    <span class="file-meta">${this.formatSize(file.size)} • ${this.formatDate(file.modified)}</span>
                </div>
                <button class="print-btn" data-file="${file.path || file.filename}" title="Печатать">▶️</button>
            </div>
        `).join('');

        // Attach print events
        listEl.querySelectorAll('.print-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const filename = e.currentTarget.dataset.file;
                if (confirm(`Начать печать: ${this.getShortName(filename)}?`)) {
                    try {
                        await this.api.startPrint(filename);
                        console.log('✅ Печать запущена:', filename);
                    } catch (err) {
                        console.error('❌ Ошибка запуска печати:', err);
                    }
                }
            });
        });
    }

    updateCurrentFile(state) {
        const currentFile = state.printer.printStats.filename;
        const items = this.querySelectorAll('.file-item');
        
        items.forEach(item => {
            const filename = item.dataset.filename;
            item.classList.toggle('active', filename === currentFile);
        });
    }

    getShortName(path) {
        if (!path) return 'Unknown';
        return path.split('/').pop();
    }

    formatSize(bytes) {
        if (!bytes) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB'];
        let i = 0;
        while (bytes >= 1024 && i < units.length - 1) {
            bytes /= 1024;
            i++;
        }
        return `${bytes.toFixed(1)} ${units[i]}`;
    }

    formatDate(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    addStyles() {
        if (document.getElementById('files-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'files-widget-styles';
        style.textContent = `
            .files-widget .widget-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .refresh-btn {
                background: none;
                border: none;
                font-size: 1rem;
                cursor: pointer;
                padding: var(--spacing-xs);
                border-radius: var(--radius-sm);
                transition: transform 0.3s ease;
            }
            .refresh-btn:hover {
                transform: rotate(180deg);
            }
            .files-list {
                max-height: 250px;
                overflow-y: auto;
            }
            .file-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: var(--spacing-sm);
                border-bottom: 1px solid var(--border-color);
                transition: background 0.2s ease;
            }
            .file-item:last-child {
                border-bottom: none;
            }
            .file-item:hover {
                background: var(--bg-tertiary);
            }
            .file-item.active {
                background: rgba(34, 197, 94, 0.1);
                border-left: 3px solid var(--accent-success);
            }
            .file-info {
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            .file-name {
                font-size: 0.9rem;
                font-weight: 500;
                color: var(--text-primary);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 200px;
            }
            .file-meta {
                font-size: 0.75rem;
                color: var(--text-secondary);
            }
            .print-btn {
                background: var(--accent-success);
                border: none;
                padding: var(--spacing-xs) var(--spacing-sm);
                border-radius: var(--radius-sm);
                cursor: pointer;
                font-size: 0.9rem;
                transition: all 0.2s ease;
            }
            .print-btn:hover {
                transform: scale(1.1);
                box-shadow: 0 2px 8px rgba(34, 197, 94, 0.4);
            }
            .loading, .error, .empty {
                text-align: center;
                padding: var(--spacing-lg);
                color: var(--text-secondary);
            }
            .error {
                color: var(--accent-error);
            }
        `;
        document.head.appendChild(style);
    }
}

customElements.define('files-widget', FilesWidget);
