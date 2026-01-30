/**
 * Web Component для отображения истории печатей
 * Использует server.history API Moonraker
 */
import store from '../services/store.js';
import api from '../services/api-instance.js';

class HistoryWidget extends HTMLElement {
    constructor() {
        super();
        this.unsubscribe = null;
        this.api = api; // Используем singleton API
        this.jobs = [];
        this.stats = { total: 0, completed: 0, failed: 0, totalTime: 0, totalFilament: 0 };
    }

    connectedCallback() {
        this.render();
        this.loadHistory();
    }

    disconnectedCallback() {
        // cleanup
    }

    render() {
        this.innerHTML = `
            <div class="widget history-widget">
                <div class="widget-header">
                    <span class="widget-title">📜 История печатей</span>
                    <button class="refresh-btn" id="btnRefreshHistory" title="Обновить">🔄</button>
                </div>
                <div class="widget-content">
                    <div class="history-stats" id="historyStats">
                        <div class="stat-card success">
                            <span class="stat-number" id="statCompleted">0</span>
                            <span class="stat-label">Завершено</span>
                        </div>
                        <div class="stat-card failed">
                            <span class="stat-number" id="statFailed">0</span>
                            <span class="stat-label">Ошибки</span>
                        </div>
                        <div class="stat-card time">
                            <span class="stat-number" id="statTime">0h</span>
                            <span class="stat-label">Всего</span>
                        </div>
                        <div class="stat-card filament">
                            <span class="stat-number" id="statFilament">0m</span>
                            <span class="stat-label">Филамент</span>
                        </div>
                    </div>
                    <div class="history-list" id="historyList">
                        <div class="loading">Загрузка истории...</div>
                    </div>
                </div>
            </div>
        `;

        this.querySelector('#btnRefreshHistory')?.addEventListener('click', () => this.loadHistory());
        this.addStyles();
    }

    async loadHistory() {
        const listEl = this.querySelector('#historyList');
        if (!listEl) return;

        listEl.innerHTML = '<div class="loading">Загрузка...</div>';

        try {
            // Загружаем историю и статистику
            const [historyResponse, statsResponse] = await Promise.all([
                this.api.getHistory(20),
                this.api.getHistoryTotals()
            ]);

            this.jobs = historyResponse.result?.jobs || [];
            
            const totals = statsResponse.result?.job_totals || {};
            this.stats = {
                total: totals.total_jobs || 0,
                completed: totals.total_jobs - (totals.total_failed || 0) || 0,
                failed: totals.total_failed || 0,
                totalTime: totals.total_time || 0,
                totalFilament: totals.total_filament_used || 0
            };

            this.updateStats();
            this.renderJobs();
        } catch (error) {
            console.error('[HistoryWidget] Failed to load history:', error);
            listEl.innerHTML = '<div class="error">История недоступна</div>';
        }
    }

    updateStats() {
        const completed = this.querySelector('#statCompleted');
        const failed = this.querySelector('#statFailed');
        const time = this.querySelector('#statTime');
        const filament = this.querySelector('#statFilament');

        if (completed) completed.textContent = this.stats.completed;
        if (failed) failed.textContent = this.stats.failed;
        if (time) time.textContent = this.formatHours(this.stats.totalTime);
        if (filament) filament.textContent = this.formatFilament(this.stats.totalFilament);
    }

    renderJobs() {
        const listEl = this.querySelector('#historyList');
        if (!listEl) return;

        if (this.jobs.length === 0) {
            listEl.innerHTML = '<div class="empty">Нет записей</div>';
            return;
        }

        listEl.innerHTML = this.jobs.slice(0, 10).map(job => `
            <div class="history-item ${job.status}">
                <div class="job-status-icon">${this.getStatusIcon(job.status)}</div>
                <div class="job-info">
                    <span class="job-name">${this.getShortName(job.filename)}</span>
                    <span class="job-meta">${this.formatDuration(job.print_duration)} • ${this.formatDate(job.end_time || job.start_time)}</span>
                </div>
                <div class="job-status-badge ${job.status}">${this.getStatusText(job.status)}</div>
            </div>
        `).join('');
    }

    getStatusIcon(status) {
        const icons = {
            'completed': '✅',
            'cancelled': '⛔',
            'error': '❌',
            'in_progress': '🔄',
            'klippy_shutdown': '⚠️',
            'klippy_disconnect': '🔌'
        };
        return icons[status] || '❓';
    }

    getStatusText(status) {
        const texts = {
            'completed': 'OK',
            'cancelled': 'Отменено',
            'error': 'Ошибка',
            'in_progress': 'В процессе',
            'klippy_shutdown': 'Shutdown',
            'klippy_disconnect': 'Disconnect'
        };
        return texts[status] || status;
    }

    getShortName(filename) {
        if (!filename) return 'Unknown';
        return filename.split('/').pop().replace('.gcode', '');
    }

    formatDuration(seconds) {
        if (!seconds) return '--:--';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    }

    formatHours(seconds) {
        if (!seconds) return '0h';
        const hours = Math.floor(seconds / 3600);
        if (hours > 24) {
            const days = Math.floor(hours / 24);
            return `${days}d`;
        }
        return `${hours}h`;
    }

    formatFilament(mm) {
        if (!mm) return '0m';
        const meters = mm / 1000;
        if (meters > 1000) {
            return `${(meters / 1000).toFixed(1)}km`;
        }
        return `${meters.toFixed(0)}m`;
    }

    formatDate(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const diff = now - date;
        
        // Относительное время
        if (diff < 3600000) { // < 1 час
            return `${Math.floor(diff / 60000)}m ago`;
        }
        if (diff < 86400000) { // < 1 день
            return `${Math.floor(diff / 3600000)}h ago`;
        }
        if (diff < 604800000) { // < 1 неделя
            return `${Math.floor(diff / 86400000)}d ago`;
        }
        
        return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    }

    addStyles() {
        if (document.getElementById('history-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'history-widget-styles';
        style.textContent = `
            .history-widget .widget-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .history-stats {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: var(--spacing-sm);
                margin-bottom: var(--spacing-md);
            }
            .stat-card {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: var(--spacing-sm);
                background: var(--bg-tertiary);
                border-radius: var(--radius-sm);
                border-left: 3px solid var(--border-color);
            }
            .stat-card.success { border-left-color: var(--accent-success); }
            .stat-card.failed { border-left-color: var(--accent-error); }
            .stat-card.time { border-left-color: var(--accent-info); }
            .stat-card.filament { border-left-color: var(--accent-warning); }
            .stat-number {
                font-size: 1.2rem;
                font-weight: 700;
                color: var(--text-primary);
                font-family: 'JetBrains Mono', monospace;
            }
            .stat-card .stat-label {
                font-size: 0.7rem;
                color: var(--text-secondary);
            }
            .history-list {
                max-height: 200px;
                overflow-y: auto;
            }
            .history-item {
                display: flex;
                align-items: center;
                gap: var(--spacing-sm);
                padding: var(--spacing-xs) var(--spacing-sm);
                border-radius: var(--radius-sm);
                margin-bottom: var(--spacing-xs);
                background: var(--bg-tertiary);
                transition: background 0.2s;
            }
            .history-item:hover {
                background: var(--bg-secondary);
            }
            .job-status-icon {
                font-size: 1rem;
            }
            .job-info {
                flex: 1;
                min-width: 0;
            }
            .job-name {
                display: block;
                font-size: 0.85rem;
                font-weight: 500;
                color: var(--text-primary);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .job-meta {
                font-size: 0.7rem;
                color: var(--text-secondary);
            }
            .job-status-badge {
                font-size: 0.65rem;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: 600;
                text-transform: uppercase;
            }
            .job-status-badge.completed {
                background: rgba(34, 197, 94, 0.2);
                color: var(--accent-success);
            }
            .job-status-badge.cancelled,
            .job-status-badge.error,
            .job-status-badge.klippy_shutdown,
            .job-status-badge.klippy_disconnect {
                background: rgba(239, 68, 68, 0.2);
                color: var(--accent-error);
            }
            .loading, .error, .empty {
                text-align: center;
                padding: var(--spacing-md);
                color: var(--text-secondary);
                font-size: 0.85rem;
            }
            .error { color: var(--accent-error); }
        `;
        document.head.appendChild(style);
    }
}

customElements.define('history-widget', HistoryWidget);
