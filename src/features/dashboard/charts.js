// 5. Chart.js: registra todos os tipos de gráfico
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

// Cores da paleta da EcoCycle (iguais às variáveis de shared/styles/style.css)
export const CORES = {
    "Plástico": '#084B60',
    "Metal": '#63A53C',
    cinza: '#5A6B72',
    aviso: '#B26A00',
    info: '#0B6E8A',
    perigo: '#C62828'
};

const OPCOES_BASE = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } }
};

/** Se o gráfico já existe no canvas (ex.: botão "Atualizar"), destrói antes de desenhar de novo. */
function criar(canvas, config) {
    Chart.getChart(canvas)?.destroy();
    return new Chart(canvas, config);
}

function eixos(empilhado, rotuloY, formatarValor) {
    return {
        x: { stacked: empilhado, grid: { display: false } },
        y: {
            stacked: empilhado,
            beginAtZero: true,
            title: { display: Boolean(rotuloY), text: rotuloY },
            ticks: formatarValor ? { callback: (v) => formatarValor(v) } : {}
        }
    };
}

/**
 * Gráfico de barras. datasets: [{ label, data, cor }]
 * opcoes: { empilhado, horizontal, rotuloY, formatarValor }
 */
export function createBarChart(canvas, rotulos, datasets, opcoes = {}) {
    const { empilhado = false, horizontal = false, rotuloY = '', formatarValor } = opcoes;
    const escalas = eixos(empilhado, horizontal ? '' : rotuloY, formatarValor);

    return criar(canvas, {
        type: 'bar',
        data: {
            labels: rotulos,
            datasets: datasets.map((d) => ({
                label: d.label,
                data: d.data,
                backgroundColor: d.cor,
                borderRadius: 4
            }))
        },
        options: {
            ...OPCOES_BASE,
            indexAxis: horizontal ? 'y' : 'x',
            scales: horizontal ? { x: escalas.y, y: escalas.x } : escalas,
            plugins: {
                ...OPCOES_BASE.plugins,
                legend: { ...OPCOES_BASE.plugins.legend, display: datasets.length > 1 }
            }
        }
    });
}

/** Gráfico de linhas. datasets: [{ label, data, cor }] */
export function createLineChart(canvas, rotulos, datasets, opcoes = {}) {
    const { rotuloY = '', formatarValor } = opcoes;

    return criar(canvas, {
        type: 'line',
        data: {
            labels: rotulos,
            datasets: datasets.map((d) => ({
                label: d.label,
                data: d.data,
                borderColor: d.cor,
                backgroundColor: d.cor,
                tension: 0.3
            }))
        },
        options: { ...OPCOES_BASE, scales: eixos(false, rotuloY, formatarValor) }
    });
}

/** Gráfico de rosca. fatias: [{ rotulo, valor, cor }] */
export function createDoughnutChart(canvas, fatias) {
    return criar(canvas, {
        type: 'doughnut',
        data: {
            labels: fatias.map((f) => f.rotulo),
            datasets: [{ data: fatias.map((f) => f.valor), backgroundColor: fatias.map((f) => f.cor) }]
        },
        options: OPCOES_BASE
    });
}
