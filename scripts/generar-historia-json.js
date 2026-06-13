// Genera includes/data/historia.json combinando:
//  - Hitos manuales (fundación, WOSM, jamborees, in memoriam).
//  - Hitos automáticos "Memorabilia anual" por cada año con agenda y/o cinta.
const fs = require('fs');
const path = require('path');

const IMG_DIR = path.join(__dirname, '..', 'images', 'historia');
const OUT     = path.join(__dirname, '..', 'includes', 'data', 'historia.json');

// 1) Detectar archivos disponibles por año
const files = fs.readdirSync(IMG_DIR);
const byYear = {}; // { 2009: { agenda: 'images/historia/...', cinta: '...' } }
files.forEach(f => {
    let m = f.match(/^(\d{4})-(agenda|cinta)\.(jpg|png)$/);
    if (!m) return;
    const [, y, kind, ext] = m;
    byYear[y] = byYear[y] || {};
    byYear[y][kind] = `images/historia/${f}`;
});

// 2) Hitos manuales (eventos institucionales / importantes)
const manualHitos = [
    {
        id: 'fundacion-2006',
        fecha: '2006',
        anio: 2006,
        destacado: true,
        categoria: 'institucional',
        titulo: 'Constitución como Asociación Civil',
        resumen: 'AGSMAC se constituye formalmente como Asociación de Grupos de Scouts de México, A.C.',
        descripcion: '<p>El <strong>2 de febrero de 2006</strong> se firma el acta constitutiva que da vida a la <strong>Asociación de Grupos de Scouts de México, A.C.</strong>, con el objeto de coadyuvar en la formación del carácter de niñ@s y jóvenes conforme a los lineamientos del movimiento scout fundado por Sir Robert Baden-Powell.</p><p>Los Grupos Scout que dieron origen a AGSMAC venían trabajando desde décadas atrás — las fotografías de <em>1986</em> y <em>1994</em> son testimonio de esa historia previa que cristalizó en la formalización de la Asociación.</p><p>[Completar: nombres de los socios fundadores y de los grupos firmantes del acta.]</p>',
        imagenes: [
            { src: 'images/historia/1994-origenes.jpg', alt: 'Antecedentes — actividad scout en 1994' },
            { src: 'images/historia/1986-origenes.jpg', alt: 'Antecedentes — actividad scout en 1986' }
        ],
        enlaces: [
            { tipo: 'pdf',     label: 'Acta Constitutiva (PDF)',                  url: 'documentos/historia/ActaConstitutiva.pdf' },
            { tipo: 'externo', label: 'El Universal — Cobertura de la fundación', url: 'https://archivo.eluniversal.com.mx/ciudad/80554.html' }
        ]
    },
    {
        id: 'wosm-2013',
        fecha: '2013-08-08',
        anio: 2013,
        destacado: true,
        categoria: 'institucional',
        titulo: 'Reconocimiento por WOSM (WOIS)',
        resumen: 'AGSMAC es reconocida como miembro del WOSM Organisational Information System (WOIS).',
        descripcion: '<p>El <strong>8 de agosto de 2013</strong> AGSMAC obtiene su reconocimiento dentro del <em>WOSM Organisational Information System</em>, marcando un paso clave en la proyección internacional de la Asociación.</p><p>Adicionalmente se formaliza la membresía mediante la <em>Carta AGSMAC al mundo</em>.</p>',
        imagenes: [
            { src: 'images/historia/2013-escudo-ttt.jpg', alt: 'Escudo del Treinta y Tres (TTT), 2013' }
        ],
        enlaces: [
            { tipo: 'pdf', label: 'Certificado WOIS (PDF)',      url: 'documentos/historia/Certificado_WOIS_2013.pdf' },
            { tipo: 'pdf', label: 'Carta AGSMAC al mundo (PDF)', url: 'documentos/historia/CartaAGSMAC-mundo.pdf' }
        ]
    },
    {
        id: 'jamboree-2015',
        anio: 2015,
        categoria: 'evento',
        titulo: '23.º Jamboree Mundial — Japón',
        resumen: 'La delegación AGSMAC participa en el Jamboree Mundial celebrado en Kirara-hama, Japón.',
        descripcion: '<p>[Completar: número de jóvenes y adultos que conformaron la delegación, anécdotas, logros.]</p>',
        imagenes: [
            { src: 'images/historia/2015-jamboree.jpg', alt: 'Delegación AGSMAC en el Jamboree Mundial 2015' }
        ],
        enlaces: [
            { tipo: 'pdf', label: 'Formulario de registro de delegación (PDF)', url: 'documentos/historia/Registro-delegacion.pdf' }
        ]
    },
    {
        id: 'campamento-2016',
        anio: 2016,
        categoria: 'evento',
        titulo: 'Campamento Scout Nacional 2016',
        resumen: 'Encuentro nacional de grupos AGSMAC.',
        descripcion: '<p>[Completar: sede, fecha exacta, número de participantes y temática del campamento.]</p>',
        imagenes: [
            { src: 'images/historia/2016-campamento.jpg', alt: 'Campamento Scout AGSMAC 2016' }
        ],
        enlaces: []
    },
    {
        id: 'jamboree-2019',
        anio: 2019,
        categoria: 'evento',
        titulo: '24.º Jamboree Mundial — Estados Unidos',
        resumen: 'Participación en el Jamboree celebrado en Summit Bechtel Reserve, West Virginia.',
        descripcion: '<p>[Completar: integrantes, experiencias, contingente mexicano.]</p>',
        imagenes: [
            { src: 'images/historia/2019-jamboree.jpg', alt: 'Jamboree Mundial 2019' }
        ],
        enlaces: []
    },
    {
        id: 'jamboree-2025',
        anio: 2025,
        categoria: 'evento',
        titulo: 'Jamboree Mundial 2025',
        resumen: 'AGSMAC presente en el Jamboree Mundial de 2025.',
        descripcion: '<p>[Completar: sede confirmada, delegación, cronología y resultados.]</p>',
        imagenes: [
            { src: 'images/historia/2025-jamboree.jpg', alt: 'Jamboree Mundial 2025' }
        ],
        enlaces: []
    },
    {
        id: 'memoriam-ejemplo',
        anio: 2024,
        categoria: 'memoriam',
        titulo: 'En memoria de [Nombre]',
        resumen: 'Reconocimiento a quienes dedicaron su vida al movimiento scout en AGSMAC.',
        descripcion: '<p>[Completar: semblanza, contribución a la Asociación, etapas de servicio y un mensaje de la familia scout.]</p>',
        persona: {
            nombre: '[Nombre completo]',
            anios: '[1950 – 2024]',
            rol: '[Rol en AGSMAC, p. ej. Fundador / Comisionado Nacional]',
            foto: '',
            bioUrl: ''
        },
        imagenes: [],
        enlaces: [{ tipo: 'externo', label: 'Biografía completa', url: '' }]
    }
];

// 3) Hitos automáticos de memorabilia (todos los años con archivos disponibles)
const memorabiliaHitos = Object.keys(byYear).sort().map(y => {
    const piezas = byYear[y];
    const imagenes = [];
    if (piezas.agenda) imagenes.push({ src: piezas.agenda, alt: `Portada de la agenda AGSMAC ${y}` });
    if (piezas.cinta)  imagenes.push({ src: piezas.cinta,  alt: `Cinta de registro ${y}` });

    let titulo, resumen;
    if (piezas.agenda && piezas.cinta) {
        titulo = `Agenda y cinta de registro ${y}`;
        resumen = `Identidad gráfica anual: portada de la agenda y cinta de registro entregadas a los miembros en ${y}.`;
    } else if (piezas.agenda) {
        titulo = `Agenda anual ${y}`;
        resumen = `Portada de la agenda anual entregada a los miembros en ${y}.`;
    } else {
        titulo = `Cinta de registro ${y}`;
        resumen = `Cinta de registro distintiva del ciclo ${y}.`;
    }

    return {
        id: `memorabilia-${y}`,
        anio: Number(y),
        categoria: 'memorabilia',
        titulo,
        resumen,
        imagenes,
        enlaces: []
    };
});

// 4) Combinar y ordenar cronológicamente ASC (el JS hará el sort visual)
const hitos = [...manualHitos, ...memorabiliaHitos].sort((a, b) => {
    if (a.anio !== b.anio) return a.anio - b.anio;
    // Dentro del mismo año: eventos antes de memorabilia
    const orderCat = { institucional: 0, evento: 1, publicacion: 2, memoriam: 3, memorabilia: 4 };
    return (orderCat[a.categoria] || 9) - (orderCat[b.categoria] || 9);
});

const output = {
    _comment_1: 'Línea del tiempo de AGSMAC — historia, hitos y memoria.',
    _comment_2: 'Fuente: appsScriptUrl (opcional, futuro) → fallback inline "hitos".',
    _comment_3: 'Patrón cascada igual que cumpleanos.json / cuadro-de-adelanto.json.',
    _comment_4: "Categorías: 'institucional' | 'evento' | 'memorabilia' | 'publicacion' | 'memoriam'.",
    _comment_5: 'Los hitos de memorabilia se generan con scripts/generar-historia-json.js a partir de images/historia/<año>-{agenda,cinta}.{jpg,png}.',
    appsScriptUrl: '',
    hitos
};

fs.writeFileSync(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
console.log(`Generados ${hitos.length} hitos (${manualHitos.length} manuales + ${memorabiliaHitos.length} memorabilia)`);
