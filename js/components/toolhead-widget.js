/**
 * Web Component для отображения позиции и скорости toolhead
 */
import store from '../services/store.js';

class ToolheadWidget extends HTMLElement {
    constructor() {
        super();
        this.unsubscribe = null;
    }

    connectedCallback() {
        this.render();
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
                    <span class="widget-title">🎯 Позиция</span>
                </div>
                <div class="widget-content">
                    <div class="position-grid">
                        <div class="axis-item">
                            <span class="axis-label">X</span>
                            <span class="axis-value" id="posX">0.00</span>
                            <span class="axis-unit">mm</span>
                        </div>
                        <div class="axis-item">
                            <span class="axis-label">Y</span>
                            <span class="axis-value" id="posY">0.00</span>
                            <span class="axis-unit">mm</span>
                        </div>
                        <div class="axis-item">
                            <span class="axis-label">Z</span>
                            <span class="axis-value" id="posZ">0.00</span>
                            <span class="axis-unit">mm</span>
                        </div>
                    </div>
                    <div class="speed-info">
                        <div class="speed-item">
                            <span class="speed-label">Скорость:</span>
                            <span class="speed-value" id="feedRate">100</span>
                            <span class="speed-unit">%</span>
                        </div>
                        <div class="speed-item">
                            <span class="speed-label">Flow:</span>
                            <span class="speed-value" id="flowRate">100</span>
                            <span class="speed-unit">%</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.addStyles();
    }

    update(state) {
        const { toolhead } = state.printer;
        
        const posX = this.querySelector('#posX');
        const posY = this.querySelector('#posY');
        const posZ = this.querySelector('#posZ');
        const feedRate = this.querySelector('#feedRate');
        const flowRate = this.querySelector('#flowRate');

        if (posX) posX.textContent = (toolhead?.position?.x ?? 0).toFixed(2);
        if (posY) posY.textContent = (toolhead?.position?.y ?? 0).toFixed(2);
        if (posZ) posZ.textContent = (toolhead?.position?.z ?? 0).toFixed(2);
        if (feedRate) feedRate.textContent = Math.round(toolhead?.speedFactor ?? 100);
        if (flowRate) flowRate.textContent = Math.round(toolhead?.extrudeFactor ?? 100);
    }

    addStyles() {
        if (document.getElementById('toolhead-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'toolhead-widget-styles';
        style.textContent = `
            .position-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: var(--spacing-md);
                margin-bottom: var(--spacing-md);
            }
            .axis-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: var(--spacing-sm);
                background: var(--bg-tertiary);
                border-radius: var(--radius-sm);
            }
            .axis-label {
                font-size: 0.8rem;
                font-weight: 700;
                color: var(--accent-primary);
            }
            .axis-value {
                font-size: 1.2rem;
                font-weight: 600;
                color: var(--text-primary);
                font-family: 'JetBrains Mono', monospace;
            }
            .axis-unit {
                font-size: 0.7rem;
                color: var(--text-secondary);
            }
            .speed-info {
                display: flex;
                justify-content: space-between;
                padding-top: var(--spacing-sm);
                border-top: 1px solid var(--border-color);
            }
            .speed-item {
                display: flex;
                align-items: center;
                gap: var(--spacing-xs);
            }
            .speed-label {
                font-size: 0.85rem;
                color: var(--text-secondary);
            }
            .speed-value {
                font-size: 1rem;
                font-weight: 600;
                color: var(--accent-success);
                font-family: 'JetBrains Mono', monospace;
            }
            .speed-unit {
                font-size: 0.8rem;
                color: var(--text-secondary);
            }
        `;
        document.head.appendChild(style);
    }
}

customElements.define('toolhead-widget', ToolheadWidget);
