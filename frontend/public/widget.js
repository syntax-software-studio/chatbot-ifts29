/*!
 * Asistente Virtual IFTS N.29 - script inyector del widget
 * -----------------------------------------------------------------------------
 * Permite embeber el asistente en el Campus Virtual (Moodle) sin permisos de
 * Administrador de plataforma: un docente lo agrega desde un recurso de tipo
 * "Página" o "Área de texto y medios" pegando una única línea.
 *
 *   <script src="https://chatbot-ifts29-jade.vercel.app/widget.js" defer></script>
 *
 * Esa línea sola crea un botón flotante en la esquina inferior derecha. Para
 * personalizar, se pueden pasar atributos data-* en la misma etiqueta:
 *
 *   <script
 *     src="https://chatbot-ifts29-jade.vercel.app/widget.js"
 *     defer
 *     data-ifts-open="1"          abre el panel al cargar
 *     data-ifts-inline="1"        sin botón flotante (embebido en el flujo)
 *     data-ifts-title="Asistente" texto del encabezado
 *     data-ifts-height="620"      alto del panel en px
 *   ></script>
 *
 * La API pública (window.IFTS29Asistente) permite además controlarla desde
 * JavaScript del propio curso.
 *
 * Licencia: MIT.
 */
(function () {
  'use strict';

  // ---------------------------------------------------------------------------
  // Configuración
  // ---------------------------------------------------------------------------
  var ORIGEN_APP = 'https://chatbot-ifts29-jade.vercel.app';
  var ALTO_PANEL = 520;
  var ANCHO_PANEL = 380;
  var ESTILO_LANZADOR =
    'position:fixed;right:20px;bottom:20px;z-index:2147483000;width:60px;height:60px;' +
    'padding:0;border:0;border-radius:50%;background:#1D3343;color:#FFCD02;cursor:pointer;' +
    'box-shadow:0 10px 40px rgba(21,38,47,.24),0 2px 8px rgba(21,38,47,.12);' +
    'display:flex;align-items:center;justify-content:center;transition:transform .18s,background-color .18s;';
  var ESTILO_LANZADOR_HOVER = 'background:#2C4A5E;transform:scale(1.06)';

  var doc = document;
  var idUnico = 'ifts29-widget-' + Math.random().toString(36).slice(2, 10);

  // Estado compartido entre las instancias del script.
  var estado = {
    iframe: null,
    contenedor: null,
    lanzador: null,
    abierto: false,
    appUrl: ORIGEN_APP,
    inline: false,
    altura: ALTO_PANEL,
    titulo: '',
    instancias: [],
  };

  /**
   * Origen real del iframe, para usarlo como targetOrigin en postMessage.
   * Se deriva de `appUrl` (que puede sobrescribirse con data-ifts-src) en
   * lugar de usar '*': así los mensajes de control no se filtran a ninguna
   * otra página. Si no se puede obtener el origen, se usa '*'.
   */
  function origenDelApp() {
    try {
      return new URL(estado.appUrl, doc.baseURI || 'https://chatbot-ifts29-jade.vercel.app').origin;
    } catch (e) {
      return '*';
    }
  }

  // ---------------------------------------------------------------------------
  // Lectura de la configuración desde el <script> que carga este archivo
  // ---------------------------------------------------------------------------
  function leerConfiguracion() {
    var scripts = doc.getElementsByTagName('script');
    for (var i = 0; i < scripts.length; i++) {
      var s = scripts[i];
      if (!s.src || s.src.indexOf('widget.js') === -1) continue;

      if (s.getAttribute('data-ifts-app')) estado.appUrl = s.getAttribute('data-ifts-app');
      if (s.getAttribute('data-ifts-inline') === '1') estado.inline = true;
      if (s.getAttribute('data-ifts-open') === '1') estado.abierto = true;
      if (s.getAttribute('data-ifts-title')) estado.titulo = s.getAttribute('data-ifts-title');
      if (s.getAttribute('data-ifts-height')) {
        var h = parseInt(s.getAttribute('data-ifts-height'), 10);
        if (!isNaN(h) && h >= 320 && h <= 900) estado.altura = h;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // UI del lanzador (el que vive en la página del Moodle, fuera del iframe)
  // ---------------------------------------------------------------------------
  function crearLanzador() {
    if (estado.lanzador) return;

    var boton = doc.createElement('button');
    boton.type = 'button';
    boton.setAttribute('style', ESTILO_LANZADOR);
    boton.setAttribute('aria-label', 'Abrir el asistente virtual del IFTS 29');
    boton.setAttribute('aria-expanded', 'false');
    boton.title = 'Asistente Virtual IFTS 29';
    boton.innerHTML =
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7' +
      'a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
      '<path d="M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01" stroke-width="2.4"/></svg>';

    boton.addEventListener('click', function () {
      alternar();
    });
    boton.addEventListener('mouseenter', function () {
      boton.setAttribute('style', ESTILO_LANZADOR + 'background:#2C4A5E;transform:scale(1.06)');
    });
    boton.addEventListener('mouseleave', function () {
      boton.setAttribute('style', ESTILO_LANZADOR);
    });

    estado.lanzador = boton;
    doc.body.appendChild(boton);
  }

  function pintarLanzador() {
    if (!estado.lanzador) return;
    estado.lanzador.setAttribute('aria-expanded', estado.abierto ? 'true' : 'false');
    estado.lanzador.setAttribute(
      'aria-label',
      estado.abierto ? 'Cerrar el asistente virtual' : 'Abrir el asistente virtual del IFTS 29',
    );
  }

  // ---------------------------------------------------------------------------
  // Iframe
  // ---------------------------------------------------------------------------
  function construirIframe(destino) {
    if (estado.iframe) return estado.iframe;

    var contenedor = doc.createElement('div');
    contenedor.id = idUnico;
    contenedor.setAttribute(
      'style',
      'position:fixed;right:20px;bottom:20px;z-index:2147482999;width:' +
        ANCHO_PANEL +
        'px;max-width:calc(100vw - 32px);display:none;' +
        'box-shadow:0 10px 40px rgba(21,38,47,.24),0 2px 8px rgba(21,38,47,.12);border-radius:16px;overflow:hidden;',
    );

    var iframe = doc.createElement('iframe');
    var params = ['embed=1', 'host=moodle'];
    if (estado.abierto) params.push('open=1');
    if (estado.titulo) params.push('titulo=' + encodeURIComponent(estado.titulo));

    iframe.src = estado.appUrl + '/?' + params.join('&');
    iframe.title = 'Asistente virtual del IFTS 29';
    iframe.setAttribute('style', 'display:block;width:100%;height:' + estado.altura + 'px;border:0;');
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.setAttribute('loading', 'lazy');
    iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');

    // La CSP del curso puede bloquear el frame: se avisa en consola.
    iframe.addEventListener('error', function () {
      console.warn('[IFTS29] No se pudo cargar el asistente. Revisá los permisos de inserción de HTML del curso.');
    });

    contenedor.appendChild(iframe);
    destino.appendChild(contenedor);

    estado.contenedor = contenedor;
    estado.iframe = iframe;
    return iframe;
  }

  function mostrar(mostrar_) {
    estado.abierto = !!mostrar_;
    if (!estado.contenedor) construirIframe(doc.body);
    estado.contenedor.style.display = estado.abierto ? 'block' : 'none';
    pintarLanzador();
    if (estado.abierto) {
      intentarEnfoque();
    }
  }

  function intentarEnfoque() {
    try {
      if (estado.iframe && estado.iframe.contentWindow) {
        estado.iframe.contentWindow.focus();
      }
    } catch (e) {
      /* cross-origin: sin efecto, no es un error */
    }
  }

  function alternar() {
    mostrar(!estado.abierto);
  }

  // ---------------------------------------------------------------------------
  // Mensajes desde el iframe y desde la página
  // ---------------------------------------------------------------------------
  window.addEventListener('message', function (evento) {
    if (!evento.data || evento.data.type !== 'ifts29:alto') return;
    if (estado.iframe && evento.source !== estado.iframe.contentWindow) return;

    var alto = parseInt(evento.data.alto, 10);
    if (isNaN(alto) || alto < 320 || alto > 900) return;

    estado.altura = alto;
    if (estado.iframe) estado.iframe.style.height = alto + 'px';
  });

  function alClicEnTecla(evento) {
    if (evento.key === 'Escape' && estado.abierto) mostrar(false);
  }

  // ---------------------------------------------------------------------------
  // Inicialización
  // ---------------------------------------------------------------------------
  function iniciar() {
    if (!doc.body) {
      doc.addEventListener('DOMContentLoaded', iniciar);
      return;
    }

    leerConfiguracion();

    // Si el script se usa dentro de un contenedor propio, se embebe ahí.
    var ancla = doc.querySelector('[data-ifts29-container]');
    if (estado.inline && ancla) {
      var iframeInline = construirIframe(ancla);
      estado.contenedor.style.position = 'relative';
      estado.contenedor.style.right = 'auto';
      estado.contenedor.style.bottom = 'auto';
      estado.contenedor.style.boxShadow = 'none';
      estado.contenedor.style.width = '100%';
      estado.contenedor.style.display = 'block';
      iframeInline.style.height = estado.altura + 'px';
    } else {
      crearLanzador();
      if (estado.abierto) mostrar(true);
    }

    doc.addEventListener('keydown', alClicEnTecla);

    // API pública.
    window.IFTS29Asistente = {
      abrir: function () { mostrar(true); },
      cerrar: function () { mostrar(false); },
      alternar: alternar,
      estaAbierto: function () { return estado.abierto; },
      reiniciar: function () {
        if (estado.iframe && estado.iframe.contentWindow) {
          estado.iframe.contentWindow.postMessage({ type: 'ifts:reiniciar' }, origenDelApp());
        }
      },
      destruir: function () {
        doc.removeEventListener('keydown', alClicEnTecla);
        if (estado.contenedor && estado.contenedor.parentNode) estado.contenedor.parentNode.removeChild(estado.contenedor);
        if (estado.lanzador && estado.lanzador.parentNode) estado.lanzador.parentNode.removeChild(estado.lanzador);
        estado.iframe = null;
        estado.contenedor = null;
        estado.lanzador = null;
      },
    };

    console.info(
      '[IFTS29] Asistente virtual inicializado. API: window.IFTS29Asistente.abrir() / .cerrar() / .alternar()',
    );
  }

  iniciar();
})();
