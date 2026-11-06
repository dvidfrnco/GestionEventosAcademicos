const TAMANO_PAGINA = 5;

let eventosFiltrados = [];
let paginaActual = 1;
let categoriasCargadas = [];


document.addEventListener("DOMContentLoaded", async function () {
  await cargarCategoriasEnFiltro();
  configurarFormularioFiltros();
  configurarPaginacion();
  configurarDetalleEvento();
  await buscarYRenderizarEventos({});
});

async function cargarCategoriasEnFiltro() {
  categoriasCargadas = await Datos.obtenerCategoriasActivas();
  const select = document.getElementById("filtro-categoria");

  categoriasCargadas.forEach(function (categoria) {
    const opcion = document.createElement("option");
    opcion.value = categoria.id;
    opcion.textContent = categoria.nombre;
    select.appendChild(opcion);
  });
}

function configurarFormularioFiltros() {
  const formulario = document.getElementById("form-filtros");

  formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    const filtros = leerFiltrosDelFormulario();
    await buscarYRenderizarEventos(filtros);
  });

  document.getElementById("btn-limpiar-filtros").addEventListener("click", async function () {
    setTimeout(async function () {
      await buscarYRenderizarEventos({});
    }, 0);
  });
}

function leerFiltrosDelFormulario() {
  return {
    texto: document.getElementById("filtro-texto").value.trim(),
    categoriaId: document.getElementById("filtro-categoria").value,
    modalidad: document.getElementById("filtro-modalidad").value,
    fecha: document.getElementById("filtro-fecha").value
  };
}

async function buscarYRenderizarEventos(filtros) {
  eventosFiltrados = await Datos.obtenerEventosPublicadosFiltrados(filtros);
  paginaActual = 1;
  renderizarListaEventos();
}

function renderizarListaEventos() {
  const lista = document.getElementById("lista-eventos");
  const vacio = document.getElementById("catalogo-vacio");
  lista.innerHTML = "";

  if (eventosFiltrados.length === 0) {
    vacio.hidden = false;
    actualizarControlesPaginacion();
    return;
  }
  vacio.hidden = true;

  const totalPaginas = calcularTotalPaginas();
  if (paginaActual > totalPaginas) paginaActual = totalPaginas;

  const inicio = (paginaActual - 1) * TAMANO_PAGINA;
  const eventosDeLaPagina = eventosFiltrados.slice(inicio, inicio + TAMANO_PAGINA);

  eventosDeLaPagina.forEach(function (evento) {
    lista.appendChild(crearElementoEvento(evento));
  });

  actualizarControlesPaginacion();
}

function crearElementoEvento(evento) {
  const li = document.createElement("li");

  const fecha = formatearFechaCorta(evento.fecha);
  const categoria = categoriasCargadas.find(function (c) { return c.id === evento.categoriaId; });

  li.innerHTML =
    '<div class="fecha">' +
      '<span class="dia">' + fecha.dia + '</span>' +
      '<span class="mes">' + fecha.mes + '</span>' +
    '</div>' +
    '<div class="detalle">' +
      '<h3>' + escaparTexto(evento.titulo) + '</h3>' +
      '<p class="meta">' + evento.horaInicio + ' - ' + evento.horaFin + ' · ' + formatearModalidad(evento.modalidad) + '</p>' +
      '<span class="categoria">' + escaparTexto(categoria ? categoria.nombre : "") + '</span> ' +
      '<span class="estado" data-estado="' + evento.estadoEfectivo + '">' + formatearEstadoEvento(evento.estadoEfectivo) + '</span>' +
    '</div>' +
    '<div class="acciones">' +
      '<button type="button" class="boton-primario" data-id="' + evento.id + '">Ver detalle</button>' +
    '</div>';

  li.querySelector("button").addEventListener("click", function () {
    mostrarDetalleEvento(evento.id);
  });

  return li;
}

function calcularTotalPaginas() {
  return Math.max(Math.ceil(eventosFiltrados.length / TAMANO_PAGINA), 1);
}

function configurarPaginacion() {
  document.getElementById("btn-pagina-anterior").addEventListener("click", function () {
    if (paginaActual > 1) {
      paginaActual--;
      renderizarListaEventos();
    }
  });

  document.getElementById("btn-pagina-siguiente").addEventListener("click", function () {
    if (paginaActual < calcularTotalPaginas()) {
      paginaActual++;
      renderizarListaEventos();
    }
  });
}

function actualizarControlesPaginacion() {
  const totalPaginas = calcularTotalPaginas();
  document.getElementById("pagina-actual").textContent = "Página " + paginaActual + " de " + totalPaginas;
  document.getElementById("btn-pagina-anterior").disabled = paginaActual <= 1;
  document.getElementById("btn-pagina-siguiente").disabled = paginaActual >= totalPaginas;
}

function configurarDetalleEvento() {
  document.getElementById("btn-cerrar-detalle").addEventListener("click", function () {
    document.getElementById("detalle-evento").hidden = true;
    document.getElementById("catalogo").hidden = false;
  });
}

async function mostrarDetalleEvento(idEvento) {
  const evento = await Datos.obtenerEventoPorId(idEvento);
  if (!evento) return;

  const categoria = categoriasCargadas.find(function (c) { return c.id === evento.categoriaId; });
  const cuposDisponibles = await Datos.obtenerCuposDisponibles(idEvento);
  const organizador = await Datos.obtenerUsuarioPorId(evento.organizadorId);

  document.getElementById("detalle-titulo").textContent = evento.titulo;
  document.getElementById("detalle-categoria").textContent = categoria ? categoria.nombre : "";
  const spanEstado = document.getElementById("detalle-estado");
  spanEstado.textContent = formatearEstadoEvento(evento.estadoEfectivo);
  spanEstado.setAttribute("data-estado", evento.estadoEfectivo);
  document.getElementById("detalle-descripcion").textContent = evento.descripcion;
  document.getElementById("detalle-fecha").textContent = formatearFechaLarga(evento.fecha);
  document.getElementById("detalle-horario").textContent = evento.horaInicio + " - " + evento.horaFin;
  document.getElementById("detalle-modalidad").textContent = formatearModalidad(evento.modalidad);
  document.getElementById("detalle-lugar").textContent = evento.ubicacion;
  document.getElementById("detalle-cupos").textContent = cuposDisponibles + " de " + evento.cupo;
  document.getElementById("detalle-organizador").textContent = organizador ? organizador.nombre : "No disponible";

  await actualizarEstadoBotonInscripcion(evento, cuposDisponibles);

  document.getElementById("catalogo").hidden = true;
  document.getElementById("detalle-evento").hidden = false;
  document.getElementById("detalle-evento").scrollIntoView({ behavior: "smooth" });
}

async function actualizarEstadoBotonInscripcion(evento, cuposDisponibles) {
  const boton = document.getElementById("btn-inscribirse");
  const mensaje = document.getElementById("detalle-mensaje");
  ocultarMensajeDetalle();

  const usuario = obtenerUsuarioActual();

  boton.onclick = null;
  boton.disabled = false;
  boton.hidden = false;
  boton.textContent = "Inscribirme";

  if (!usuario) {
    boton.disabled = true;
    mostrarMensajeDetalle("Inicia sesión para inscribirte a este evento.", false);
    return;
  }

  const inscripcionesDelUsuario = await Datos.obtenerInscripcionesPorUsuario(usuario.id);
  const yaInscrito = inscripcionesDelUsuario.some(function (i) {
    return i.eventoId === evento.id && i.estado === Datos.ESTADOS_INSCRIPCION.ACTIVA;
  });

  if (yaInscrito) {
    boton.disabled = true;
    boton.textContent = "Ya estás inscrito";
    mostrarMensajeDetalle("Ya tienes una inscripción activa en este evento. Puedes cancelarla desde Mi agenda.", false);
    return;
  }

  if (!Datos.eventoAceptaInscripciones(evento)) {
    boton.disabled = true;
    mostrarMensajeDetalle("Este evento no está disponible para inscripciones en este momento.", false);
    return;
  }

  if (cuposDisponibles <= 0) {
    boton.disabled = true;
    mostrarMensajeDetalle("No hay cupos disponibles para este evento.", false);
    return;
  }

  boton.onclick = function () { inscribirseAlEvento(evento.id); };
}

async function inscribirseAlEvento(idEvento) {
  const usuario = obtenerUsuarioActual();
  if (!usuario) return;

  const boton = document.getElementById("btn-inscribirse");
  boton.disabled = true;

  try {
    await Datos.crearInscripcion(idEvento, usuario.id);
    mostrarMensajeDetalle("Te inscribiste correctamente. Puedes verlo en Mi agenda.", true);
    boton.textContent = "Ya estás inscrito";
  } catch (error) {
    mostrarMensajeDetalle(error.message, false);
    boton.disabled = false;
  }
}

function mostrarMensajeDetalle(texto, esExito) {
  const mensaje = document.getElementById("detalle-mensaje");
  mensaje.textContent = texto;
  mensaje.hidden = false;
  mensaje.classList.toggle("mensaje-exito", !!esExito);
}

function ocultarMensajeDetalle() {
  const mensaje = document.getElementById("detalle-mensaje");
  mensaje.hidden = true;
  mensaje.classList.remove("mensaje-exito");
}

const NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatearFechaCorta(fechaIso) {
  const partes = fechaIso.split("-");
  const mes = Number(partes[1]) - 1;
  return { dia: partes[2], mes: NOMBRES_MES[mes] };
}

function formatearFechaLarga(fechaIso) {
  const partes = fechaIso.split("-");
  const mes = Number(partes[1]) - 1;
  return Number(partes[2]) + " de " + NOMBRES_MES_LARGO[mes] + " de " + partes[0];
}

const NOMBRES_MES_LARGO = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

function formatearModalidad(modalidad) {
  return modalidad === "VIRTUAL" ? "Virtual" : "Presencial";
}

function formatearEstadoEvento(estado) {
  const nombres = {
    BORRADOR: "Borrador",
    PUBLICADO: "Publicado",
    CERRADO: "Cerrado",
    CANCELADO: "Cancelado",
    FINALIZADO: "Finalizado"
  };
  return nombres[estado] || estado;
}

function escaparTexto(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}
