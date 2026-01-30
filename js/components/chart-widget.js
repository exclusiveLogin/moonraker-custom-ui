/**
 * Web Component для графиков временных рядов (температура, скорость и т.д.)
 * Использует Canvas API без внешних зависимостей
 */
import store from '../services/store.js';

class ChartWidget extends HTMLElement {
    constructor() {
        super();
        this.unsubscribe = null;
        this.canvas = null;
        this.ctx = null;
        
        // Конфигурация графика
        this.maxPoints = 120; // 2 минуты при обновлении каждую секунду
        this.updateInterval = 1000; // ms
        
        // Данные для графиков
        this.history = {
            timestamps: [],
            hotend: [],
            hotendTarget: [],
            bed: [],
            bedTarget: [],
            fanSpeed: []
        };
        
        this.colors = {
            hotend: '#ef4444',      // красный
            hotendTarget: '#fca5a5', // светло-красный
            bed: '#06b6d4',         // циан
            bedTarget: '#67e8f9',   // светло-циан
            fanSpeed: '#22c55e',    // зеленый
            grid: '#404040',
            text: '#9ca3af',
            bg: '#1f2937'
        };
        
        this.intervalId = null;
    }

    connectedCallback() {
        this.render();
        this.setupCanvas();
        
        // Подписываемся на обновления store
        this.unsubscribe = store.subscribe((state) => {
            this.addDataPoint(state);
        });
        
        // Периодически перерисовываем график
        this.intervalId = setInterval(() => {
            this.drawChart();
        }, this.updateInterval);
        
        // Первоначальная отрисовка
        this.drawChart();
    }

    disconnectedCallback() {
        if (this.unsubscribe) {
            this.unsubscribe();
        }
        if (this.intervalId) {
            clearInterval(this.intervalId);
        }
    }

    render() {
        this.innerHTML = `
            <div class="widget chart-widget">
                <div class="widget-header">
                    <span class="widget-title">📈 Температура</span>
                    <div class="chart-legend">
                        <span class="legend-item"><span class="legend-color" style="background: ${this.colors.hotend}"></span>Hotend</span>
                        <span class="legend-item"><span class="legend-color" style="background: ${this.colors.bed}"></span>Bed</span>
                    </div>
                </div>
                <div class="widget-content">
                    <canvas id="tempChart" width="400" height="180"></canvas>
                    <div class="chart-stats">
                        <div class="stat-item">
                            <span class="stat-label">Hotend:</span>
                            <span class="stat-value" id="currentHotend" style="color: ${this.colors.hotend}">--°C</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Bed:</span>
                            <span class="stat-value" id="currentBed" style="color: ${this.colors.bed}">--°C</span>
                        </div>
                        <div class="stat-item">
                            <span class="stat-label">Max:</span>
                            <span class="stat-value" id="maxTemp">--°C</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.addStyles();
    }

    setupCanvas() {
        this.canvas = this.querySelector('#tempChart');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            
            // Подгоняем под DPI экрана для четкости
            const dpr = window.devicePixelRatio || 1;
            const rect = this.canvas.getBoundingClientRect();
            this.canvas.width = rect.width * dpr;
            this.canvas.height = rect.height * dpr;
            this.ctx.scale(dpr, dpr);
            this.canvas.style.width = rect.width + 'px';
            this.canvas.style.height = rect.height + 'px';
        }
    }

    addDataPoint(state) {
        const now = Date.now();
        const { temperature } = state.printer;
        const { fans } = state.printer;
        
        // Добавляем новые данные
        this.history.timestamps.push(now);
        this.history.hotend.push(temperature.hotend.current);
        this.history.hotendTarget.push(temperature.hotend.target);
        this.history.bed.push(temperature.bed.current);
        this.history.bedTarget.push(temperature.bed.target);
        this.history.fanSpeed.push((fans?.partFan ?? 0) * 100);
        
        // Ограничиваем количество точек
        if (this.history.timestamps.length > this.maxPoints) {
            this.history.timestamps.shift();
            this.history.hotend.shift();
            this.history.hotendTarget.shift();
            this.history.bed.shift();
            this.history.bedTarget.shift();
            this.history.fanSpeed.shift();
        }
        
        // Обновляем текущие значения
        this.updateStats(state);
    }

    updateStats(state) {
        const { temperature } = state.printer;
        
        const currentHotend = this.querySelector('#currentHotend');
        const currentBed = this.querySelector('#currentBed');
        const maxTemp = this.querySelector('#maxTemp');
        
        if (currentHotend) {
            currentHotend.textContent = `${temperature.hotend.current.toFixed(1)}°C → ${temperature.hotend.target}°C`;
        }
        if (currentBed) {
            currentBed.textContent = `${temperature.bed.current.toFixed(1)}°C → ${temperature.bed.target}°C`;
        }
        if (maxTemp && this.history.hotend.length > 0) {
            const max = Math.max(...this.history.hotend, ...this.history.bed);
            maxTemp.textContent = `${max.toFixed(0)}°C`;
        }
    }

    drawChart() {
        if (!this.ctx || this.history.timestamps.length < 2) return;
        
        const canvas = this.canvas;
        const ctx = this.ctx;
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        const padding = { top: 10, right: 10, bottom: 25, left: 45 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        // Очищаем canvas
        ctx.fillStyle = this.colors.bg;
        ctx.fillRect(0, 0, width, height);
        
        // Находим min/max для масштабирования
        const allValues = [
            ...this.history.hotend,
            ...this.history.hotendTarget,
            ...this.history.bed,
            ...this.history.bedTarget
        ].filter(v => v > 0);
        
        const minVal = 0;
        const maxVal = Math.max(250, ...allValues) + 10;
        
        // Рисуем сетку и оси
        this.drawGrid(ctx, padding, chartWidth, chartHeight, minVal, maxVal);
        
        // Рисуем линии данных
        this.drawLine(ctx, this.history.hotendTarget, this.colors.hotendTarget, padding, chartWidth, chartHeight, minVal, maxVal, true);
        this.drawLine(ctx, this.history.bedTarget, this.colors.bedTarget, padding, chartWidth, chartHeight, minVal, maxVal, true);
        this.drawLine(ctx, this.history.hotend, this.colors.hotend, padding, chartWidth, chartHeight, minVal, maxVal);
        this.drawLine(ctx, this.history.bed, this.colors.bed, padding, chartWidth, chartHeight, minVal, maxVal);
    }

    drawGrid(ctx, padding, chartWidth, chartHeight, minVal, maxVal) {
        ctx.strokeStyle = this.colors.grid;
        ctx.lineWidth = 0.5;
        ctx.fillStyle = this.colors.text;
        ctx.font = '10px monospace';
        
        // Горизонтальные линии (температура)
        const steps = 5;
        for (let i = 0; i <= steps; i++) {
            const y = padding.top + (chartHeight / steps) * i;
            const value = maxVal - ((maxVal - minVal) / steps) * i;
            
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();
            
            // Подписи
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${value.toFixed(0)}°`, padding.left - 5, y);
        }
        
        // Временная ось
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const timeLabels = ['2m', '1m', 'now'];
        timeLabels.forEach((label, i) => {
            const x = padding.left + (chartWidth / 2) * i;
            ctx.fillText(label, x, padding.top + chartHeight + 5);
        });
    }

    drawLine(ctx, data, color, padding, chartWidth, chartHeight, minVal, maxVal, dashed = false) {
        if (data.length < 2) return;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = dashed ? 1 : 2;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        
        if (dashed) {
            ctx.setLineDash([4, 4]);
        } else {
            ctx.setLineDash([]);
        }
        
        ctx.beginPath();
        
        for (let i = 0; i < data.length; i++) {
            const x = padding.left + (chartWidth / (this.maxPoints - 1)) * i;
            const y = padding.top + chartHeight - ((data[i] - minVal) / (maxVal - minVal)) * chartHeight;
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        
        ctx.stroke();
        ctx.setLineDash([]);
    }

    addStyles() {
        if (document.getElementById('chart-widget-styles')) return;

        const style = document.createElement('style');
        style.id = 'chart-widget-styles';
        style.textContent = `
            .chart-widget {
                min-width: 350px;
            }
            .chart-widget .widget-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: var(--spacing-sm);
            }
            .chart-legend {
                display: flex;
                gap: var(--spacing-md);
                font-size: 0.75rem;
            }
            .legend-item {
                display: flex;
                align-items: center;
                gap: 4px;
                color: var(--text-secondary);
            }
            .legend-color {
                width: 12px;
                height: 3px;
                border-radius: 2px;
            }
            #tempChart {
                width: 100%;
                height: 180px;
                border-radius: var(--radius-sm);
            }
            .chart-stats {
                display: flex;
                justify-content: space-between;
                margin-top: var(--spacing-sm);
                padding-top: var(--spacing-sm);
                border-top: 1px solid var(--border-color);
            }
            .stat-item {
                display: flex;
                flex-direction: column;
                align-items: center;
            }
            .stat-label {
                font-size: 0.75rem;
                color: var(--text-secondary);
            }
            .stat-value {
                font-size: 0.9rem;
                font-weight: 600;
                font-family: 'JetBrains Mono', monospace;
            }
        `;
        document.head.appendChild(style);
    }
}

customElements.define('chart-widget', ChartWidget);
