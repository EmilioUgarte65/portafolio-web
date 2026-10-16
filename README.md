# Portafolio de Emilio Fonseca

Portafolio bilingüe con showcases y demos de los frontends originales.

Las interfaces mantienen su distribución, tipografías, espaciado, paneles y controles. Las adaptaciones se limitan a identidad visual, paletas, datos ficticios y proveedores locales de datos necesarios para la demostración.

El catálogo incluye 21 proyectos y 15 demos de sus frontends originales: Web Studio, Nexo, Lumen, Núcleo, Pulso, Vértice, Vitrina, Distrito, Ruta Clara, MyAccountant, Ourway, Mundial, Radar, Marquesina y Totem.

Festo, Brújula, Dexter y Dino AI conservan sus showcases como proyectos y automatizaciones de backend sin frontend inventado. Inferencia eficiente presenta mediciones verificadas de su línea base. Juego de construcción tiene showcase, pero su demo jugable requiere una compilación sin identidad empresarial.

Para abrir la versión local: `python -m http.server 4173`. Abre `http://localhost:4173/`.

Los frontends viven en `demos/`. Sus estilos son los originales; no comparten una hoja que sustituya el diseño de las aplicaciones. Los adaptadores usan datos ficticios y no conectan cuentas ni servicios empresariales.

Ruta Clara ejecuta en un Web Worker el motor original de rutas, sobre una red vial pública de OpenStreetMap. Los mapas base requieren conexión; el cálculo de recorridos utiliza el grafo incluido. Los pedidos, unidades y ubicaciones de entrega son inventados. La demostración del plan conserva una asignación de ejemplo y no sustituye la optimización completa del servidor.

Distrito conserva el motor, modelos y objetos 3D originales. Web Studio permite explorar su editor con medios sintéticos; las funciones que requieren motores de render o servicios de IA no se conectan a servicios reales.

`tools/build_showcase_additions.py` actualiza las primeras cuatro presentaciones nuevas y sus tarjetas. `tools/complete_original_showcases.py` integra las diez presentaciones restantes y sus accesos. Ninguno genera sustitutos de las aplicaciones. `tools/build_public_cv.py` genera los CV públicos.

Festo presenta el flujo de automatización y render dinámico de felicitaciones. Totem administra textos y contenidos en memoria, sin controlar pantallas. Ourway conserva la escena orbital original; las conexiones a álbumes privados están deshabilitadas. Radar usa clientes, cotizaciones y series ficticias; los módulos sin muestra permanecen vacíos. Mundial conserva el conjunto público del proyecto y su fecha de corte. Marquesina utiliza un perfil ficticio y videos propios, sin atribuir a Emilio la carrera o producción audiovisual de otra persona.

La revisión local está documentada en `docs/REVISION-FRONTENDS.md`. La actualización completa del portafolio permanece local.

Ourway y MyAccountant están publicados por separado, con datos de ejemplo y sus diseños originales:

- [Ourway](https://emiliougarte65.github.io/web-dev-eyes-personal-demos/ourway/)
- [MyAccountant](https://emiliougarte65.github.io/web-dev-eyes-personal-demos/myaccountant/)

El [repositorio de publicación](https://github.com/EmilioUgarte65/web-dev-eyes-personal-demos) contiene únicamente las demos compiladas. Los repositorios fuente siguen privados. La comprobación del sitio público está en `docs/VERIFICACION-PUBLICACION-PERSONALES.json`.
