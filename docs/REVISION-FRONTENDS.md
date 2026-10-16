# Revisión de frontends — 15 de octubre de 2026

Se retiraron las pantallas simplificadas y los estilos compartidos que sustituían los diseños originales. Se recuperaron las interfaces de dieciséis aplicaciones: Web Studio, Nexo, Lumen, Núcleo, Pulso, Vértice, Vitrina, Distrito, Ruta Clara, MyAccountant, Ourway, Mundial, Radar, Marquesina, Festo y Totem.

Se mantienen la retícula, tipografías, tamaños, espacios, paneles, controles y recursos 3D originales. Las diferencias visuales corresponden a colores, logos e imágenes de marca. Los datos de las demos son ficticios.

Las fotografías de cemento y grifería se revisaron visualmente. El saco únicamente muestra «CEMENTO» y «WEB DEV-EYES»; la grifería no muestra marca. Se recuperaron los banners fotográficos del catálogo y se conservaron las herramientas sin marcas comerciales visibles.

Ruta Clara dejó de dibujar líneas entre puntos. Utiliza el motor original de búsqueda de rutas sobre una red vial pública, considerando sentidos y giros. Se probaron el plan del día, la comparación entre dos ubicaciones ficticias, carga, reportes, pedidos, flota y chofer. La asignación de entregas es un ejemplo fijo; la demo no ejecuta el optimizador completo del servidor.

Se comprobaron en navegador las nueve demos sin errores de JavaScript ni recursos HTTP fallidos durante los recorridos probados. Se verificaron el editor y la reproducción en Web Studio, la bandeja de Nexo, Balance General de Lumen, eventos en Núcleo, el panel de Pulso, la ficha de producto de Vitrina, y el cuarto y catálogo de mascotas de Distrito.

La comparación de estilos ignora exclusivamente valores de color, comentarios y sustituciones de identidad. Los resultados se guardan en `VERIFICACION-DISENO.json`. Las pruebas de interacción están en `VERIFICACION-DEMOS.json`.

Los adaptadores de demostración sustituyen servicios por datos locales; las funciones que requieren servicios de IA, render o sistemas empresariales no se conectan a servicios reales. Los proyectos sin un frontend disponible conservan sus presentaciones originales.

La actualización del repositorio del portafolio permanece local, sin commits ni despliegue de ese repositorio.

## Proyectos recuperados en la segunda revisión

| Proyecto | Material incluido | Alcance de la demostración |
|---|---|---|
| MyAccountant | Frontend React y mascotas originales | Conjunto de prueba propio, cuentas y movimientos ficticios, sin Firebase real |
| Ourway | Frontend y escena orbital 3D originales | Viaje vacío, mapas y navegación; sin álbumes privados |
| Mundial | Frontend y datos públicos originales | Modelos, cuadro, grupos, estadísticas y validación en la fecha de corte del proyecto |
| Radar | Dashboard original | Clientes, cotizaciones y series mensuales ficticias; otros módulos sin muestra pueden estar vacíos |
| Marquesina | Frontend audiovisual original | Perfil ficticio y reproductor con escenas 3D propias; sin fotos, contactos ni videos de clientes |
| Festo | Tarjetas, controles y plantilla original adaptada | Cumpleaños ficticios, descarga de PNG y envíos simulados |
| Totem | Panel React original | CRUD de textos y servicios locales en memoria; no controla equipos reales |
| Criatura | Video auténtico del entrenamiento | Reproducción de locomoción simulada, sin una app web inventada |
| Inferencia eficiente | Mediciones verificadas de la línea base | gemma3:1b a 129.6 tokens/s y llama3.2 a 82.6 tokens/s en el entorno documentado; no ejecuta modelos |
| Juego de construcción | Showcase del proyecto Unity | **Falta una build sin marcas para habilitar el juego** |

Los seis proyectos sin demo de frontend son Brújula, Dexter, Dino AI, Criatura, Inferencia eficiente y Juego de construcción. Tener showcase no implica una demo jugable. El catálogo tiene 22 proyectos únicos; se retiró la tarjeta duplicada de Nexo.

Los scripts de construcción de las presentaciones no modifican las aplicaciones. La versión original de cada proyecto se conserva fuera del portafolio; las adaptaciones se prepararon en copias separadas.

## Verificación adicional

Las siete demos recuperadas pasaron los recorridos registrados en `VERIFICACION-PROYECTOS-RESTANTES.json`, sin errores de JavaScript ni respuestas HTTP fallidas en esas interacciones. Se verificaron la descarga PNG de Festo, el alta de textos de Totem, las vistas de Mundial, las doce secciones y una ficha ficticia de Radar, la navegación de Ourway y MyAccountant, y la reproducción de Marquesina. Los recursos del reproductor se sirven localmente.

Las nuevas presentaciones y las dos portadas se comprobaron a 1440 y 390 píxeles de ancho. `VERIFICACION-DISENO-RESTANTES.json` confirma que las hojas de estilo comparadas conservan su estructura y que las clases de 61 componentes JSX coinciden con las fuentes originales. La revisión textual de las siete demos no encontró las marcas, nombres de cliente, contactos privados ni claves reales buscadas; no sustituye una auditoría completa de todos los recursos binarios.

## Publicación de desarrollos personales — 15 de octubre de 2026

Por autorización del usuario, Ourway y MyAccountant se publicaron en un repositorio separado de GitHub Pages. Incluye solo las demos compiladas, recursos visuales y datos de ejemplo. Los dos repositorios fuente conservan su visibilidad privada.

- Ourway: https://emiliougarte65.github.io/web-dev-eyes-personal-demos/ourway/
- MyAccountant: https://emiliougarte65.github.io/web-dev-eyes-personal-demos/myaccountant/

Las páginas públicas se comprobaron en un navegador nuevo, verificando respuesta HTTP, recursos, ejecución de JavaScript y navegación. Sus botones de lanzamiento se actualizaron en los showcases locales. Las conexiones a álbumes privados y a información financiera real permanecen deshabilitadas.

El usuario confirmó que el juego Unity ya tiene una versión pública. La versión sin identidad empresarial para este portafolio sigue pendiente.
