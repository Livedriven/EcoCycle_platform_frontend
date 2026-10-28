// src/shared/setup.js

// 1. Bootstrap (CSS + JS de dropdown, modal, collapse...)
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap';

// 2. Ícones
import 'bootstrap-icons/font/bootstrap-icons.css';

// 3. Tema do Grid.js (as tabelas)
import 'gridjs/dist/theme/mermaid.min.css';

// 6. Seu CSS por último, para sobrescrever o Bootstrap
import './styles/style.css';

if (import.meta.env.MODE === 'demo') {
    const aviso = document.createElement('aside');
    aviso.className = 'alert alert-warning text-center rounded-0 mb-0';
    aviso.setAttribute('role', 'status');
    aviso.textContent = 'Modo demonstração — dados simulados';
    document.body.prepend(aviso);
    document.title = '[DEMO] ' + document.title;
}
