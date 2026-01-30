/**
 * Web Component для управления принтером
 */
import store from '../services/store.js';
import api from '../services/api-instance.js';

class ControlWidget extends HTMLElement {
    constructor() {
        super();
        this.unsubscribe = null;
        this.api = api; // Используем singleton API
    }

    connectedCallback() {
        this.render();
        this.attachEvents();
        this.unsubscribe = store.subscribe((state) => {
            this.update(state);
        });
    }

    disconnectedCallback() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
    }

    render() {
        this.innerHTML = `
            <div class="widget">
                <div class="widget-header">
                    <span class="widget-title">🎛️ Управление</span>
                </div>
                <div class="widget-content">
                    <div class="control-grid">
                        <button class="control-btn home" id="btnHomeAll" title="Home All">
                            <span class="btn-icon">🏠</span>
                            <span class="btn-label">Home</span>
                        </button>
                        <button class="control-btn pause" id="btnPause" title="Пауза">
                            <span class="btn-icon">⏸️</span>
                            <span class="btn-label">Пауза</span>
                        </button>
                        <button class="control-btn resume" id="btnResume" title="Продолжить">
                            <span class="btn-icon">▶️</span>
                            <span class="btn-label">Продолжить</span>
                        </button>
                        <button class="control-btn cancel" id="btnCancel" title="Отмена">
                            <span class="btn-icon">⛔</span>
                            <span class="btn-label">Отмена</span>
                        </button>
                    </div>
                    <div class="emergency-section">
                        <button class="control-btn emergency" id="btnEmergency" title="Аварийная остановка">
                            <span class="btn-icon">🚨</span>
                            <span class="btn-label">E-STOP</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        this.addStyles();
    }

    attachEvents() {
        // Home All
        this.querySelector('#btnHomeAll')?.addEventListener('click', async () => {
            try {
                await this.api.sendGcode('G28');
                this.showFeedback('Home запущен');
            } catch (e) {
                this.showFeedback('Ошибка: ' + e.message, true);
            }
        });

        // Pause
        this.querySelector('#btnPause')?.addEventListener('click', async () => {
            try {
                await this.api.pausePrint();
                this.showFeedback('Печать на паузе');
            } catch (e) {
                this.showFeedback('Ошибка: ' + e.message, true);
            }
        });

        // Resume
        this.querySelector('#btnResume')?.addEventListener('click', async () => {
            try {
                await this.api.resumePrint();
                this.showFeedback('Печать продолжена');
            } catch (e) {
                this.showFeedback('Ошибка: ' + e.message, true);
            }
        });

        // Cancel
        this.querySelector('#btnCancel')?.addEventListener('click', async () => {
            if (confirm('Отменить печать?')) {
                try {
                    await this.api.cancelPrint();
                    this.showFeedback('Печать отменена');
                } catch (e) {
                    this.showFeedback('Ошибка: ' + e.message, true);
                }
            }
        });

        // Emergency Stop
        this.querySelector('#btnEmergency')?.addEventListener('click', async () => {
            try {
                await this.api.emergencyStop();
                this.showFeedback('АВАРИЙНАЯ ОСТАНОВКА!', true);
            } catch (e) {
                this.showFeedback('Ошибка: ' + e.message, true);
            }
        });
    }

    showFeedback(message, isError = false) {
        // Можно добавить toast-уведомление
        console.log(isError ? `❌ ${message}` : `✅ ${message}`);
    }

    update(state) {
        const { printStats } = state.printer;
        const isPrinting = printStats.state === 'printing';
        const isPaused = printStats.state === 'paused';
        
        // Disable/enable buttons based on state
        const btnPause = this.querySelector('#btnPause');
        const btnResume = this.querySelector('#btnResume');
        const btnCancel = this.querySelector('#btnCancel');
        
        if (btnPause) btnPause.disabled = !isPrinting;
        if (btnResume) btnResume.disabled = !isPaused;
        if (btnCancel) btnCancel.disabled = !isPrinting && !isPaused;
    }

    addStyles() {
        if (document.getElementById('control-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'control-widget-styles';
        style.textContent = `
            .control-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: var(--spacing-sm);
                margin-bottom: var(--spacing-md);
            }
            .control-btn {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: var(--spacing-md);
                border: none;
                border-radius: var(--radius-md);
                background: var(--bg-tertiary);
                color: var(--text-primary);
                cursor: pointer;
                transition: all 0.2s ease;
            }
            .control-btn:hover:not(:disabled) {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }
            .control-btn:active:not(:disabled) {
                transform: translateY(0);
            }
            .control-btn:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }
            .control-btn .btn-icon {
                font-size: 1.5rem;
                margin-bottom: var(--spacing-xs);
            }
            .control-btn .btn-label {
                font-size: 0.8rem;
                font-weight: 500;
            }
            .control-btn.home:hover:not(:disabled) {
                background: var(--accent-info);
            }
            .control-btn.pause:hover:not(:disabled) {
                background: var(--accent-warning);
            }
            .control-btn.resume:hover:not(:disabled) {
                background: var(--accent-success);
            }
            .control-btn.cancel:hover:not(:disabled) {
                background: var(--accent-error);
            }
            .emergency-section {
                padding-top: var(--spacing-sm);
                border-top: 1px solid var(--border-color);
            }
            .control-btn.emergency {
                width: 100%;
                background: linear-gradient(135deg, #dc2626, #991b1b);
                color: white;
                font-weight: 700;
            }
            .control-btn.emergency:hover {
                background: linear-gradient(135deg, #ef4444, #dc2626);
                box-shadow: 0 4px 20px rgba(220, 38, 38, 0.5);
            }
        `;
        document.head.appendChild(style);
    }
}

customElements.define('control-widget', ControlWidget);
