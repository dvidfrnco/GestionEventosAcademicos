let usuarioActual = null;
let inscripcionIdACancelar = null;


document.addEventListener("DOMContentLoaded", async function () {
  // Cualquier persona con sesión iniciada puede ver su propia agenda.
  usuarioActual = exigirSesion();
  if (!usuarioActual) return;

  configurarPestanas();
  configurarDialogoCancelar();
  await cargarAgenda();
});

function configurarPestanas() {
  const tabActivas = document.getElementById("tab-activas");
  const tabHistorial = document.getElementById("tab-historial");
  const panelActivas = document.getElementById("panel-activas");
  const panelHistorial = document.getElementById("panel-historial");

  tabActivas.addEventListener("click", function () {
    tabActivas.setAttribute("aria-selected", "true");
    tabHistorial.setAttribute("aria-selected", "false");
    panelActivas.hidden = false;
    panelHistorial.hidden = true;
  });

  tabHistorial.addEventListener("click", function () {
    tabHistorial.setAttribute("aria-selected", "true");
    tabActivas.setAttribute("aria-selected", "false");
    panelHistorial.hidden = false;
    panelActivas.hidden = true;
  });
}

async function cargarAgenda() {
  const inscripciones = await Datos.obtenerInscripcionesPorUsuario(usuarioActual.id);

  // A cada inscripción le anexamos el evento y la asistencia correspondiente
  // para no tener que consultarlos varias veces en la pantalla.
  const inscripcionesCompletas = await Promise.all(inscripciones.map(async function (inscripcion) {
    const evento = await Datos.obtenerEventoPorId(inscripcion.eventoId);
    const asistencia = await Datos.obtenerAsistenciaPorInscripcion(inscripcion.id);
    return { inscripcion: inscripcion, evento: evento, asistencia: asistencia };
  }));

  const activas = inscripcionesCompletas.filter(function (item) { return !esDeHistorial(item); });
  const historial = inscripcionesCompletas.filter(function (item) { return esDeHistorial(item); });

  activas.sort(function (a, b) { return (a.evento.fecha + a.evento.horaInicio).localeCompare(b.evento.fecha + b.evento.horaInicio); });
  historial.sort(function (a, b) { return (b.evento.fecha + b.evento.horaInicio).localeCompare(a.evento.fecha + a.evento.horaInicio); });

  renderizarResumen(activas.length, historial.length);
  renderizarLista("lista-activas", "vacio-activas", activas, true);
  renderizarLista("lista-historial", "vacio-historial", historial, false);
}

function esDeHistorial(item) {
  if (item.inscripcion.estado === Datos.ESTADOS_INSCRIPCION.CANCELADA) return true;
  if (!item.evento) return true;
  return item.evento.estadoEfectivo === Datos.ESTADOS_EVENTO.FINALIZADO ||
         item.evento.estadoEfectivo === Datos.ESTADOS_EVENTO.CANCELADO;
}

function calcularEstadoMostrado(item) {
  if (item.inscripcion.estado === Datos.ESTADOS_INSCRIPCION.CANCELADA) return "CANCELADA";
  if (item.asistencia) return item.asistencia.estadoAsistencia;
  return "ACTIVA";
}

function renderizarResumen(cantidadActivas, cantidadHistorial) {
  const resumen = document.getElementById("resumen");
  resumen.innerHTML =
    '<div class="indicador"><span class="valor">' + cantidadActivas + '</span><span class="etiqueta">Inscripciones activas</span></div>' +
    '<div class="indicador"><span class="valor">' + cantidadHistorial + '</span><span class="etiqueta">En historial</span></div>';
}

function renderizarLista(idLista, idVacio, items, esListaDeActivas) {
  const lista = document.getElementById(idLista);
  const vacio = document.getElementById(idVacio);
  lista.innerHTML = "";

  if (items.length === 0) {
    vacio.hidden = false;
    return;
  }
  vacio.hidden = true;

  items.forEach(function (item) {
    lista.appendChild(crearElementoInscripcion(item, esListaDeActivas));
  });
}

function crearElementoInscripcion(item, esListaDeActivas) {
  const li = document.createElement("li");
  const estadoMostrado = calcularEstadoMostrado(item);
  li.className = "inscripcion";
  li.setAttribute("data-estado", estadoMostrado);

  const evento = item.evento;
  const fecha = formatearFechaCorta(evento.fecha);

  li.innerHTML =
    '<div class="fecha">' +
      '<span class="dia">' + fecha.dia + '</span>' +
      '<span class="mes">' + fecha.mes + '</span>' +
    '</div>' +
    '<div class="detalle">' +
      '<h3>' + escaparTexto(evento.titulo) + '</h3>' +
      '<p class="meta">' + evento.horaInicio + ' - ' + evento.horaFin + ' · ' + (evento.modalidad === "VIRTUAL" ? "Virtual" : "Presencial") + '</p>' +
      '<span class="estado" data-estado="' + estadoMostrado + '">' + formatearEstadoMostrado(estadoMostrado) + '</span>' +
    '</div>' +
    '<div class="acciones"></div>';

  const contenedorAcciones = li.querySelector(".acciones");

  if (esListaDeActivas && Datos.evantoPermiteCancelarInscripcion(evento)) {
    const botonCancelar = document.createElement("button");
    botonCancelar.type = "button";
    botonCancelar.className = "boton-peligro";
    botonCancelar.textContent = "Cancelar inscripción";
    botonCancelar.addEventListener("click", function () { abrirDialogoCancelar(item.inscripcion.id); });
    contenedorAcciones.appendChild(botonCancelar);
  }

  return li;
}

function formatearEstadoMostrado(estado) {
  const nombres = {
    ACTIVA: "Activa",
    CANCELADA: "Cancelada",
    ASISTIO: "Asistió",
    NO_ASISTIO: "No asistió"
  };
  return nombres[estado] || estado;
}

function configurarDialogoCancelar() {
  const dialogo = document.getElementById("dialogo-cancelar");

  document.getElementById("btn-mantener").addEventListener("click", function () {
    dialogo.close();
  });

  document.getElementById("btn-confirmar-cancelar").addEventListener("click", async function () {
    if (!inscripcionIdACancelar) return;

    try {
      await Datos.cancelarInscripcion(inscripcionIdACancelar, usuarioActual.id);
      dialogo.close();
      inscripcionIdACancelar = null;
      await cargarAgenda();
    } catch (error) {
      alert(error.message);
    }
  });
}

function abrirDialogoCancelar(idInscripcion) {
  inscripcionIdACancelar = idInscripcion;
  document.getElementById("dialogo-cancelar").showModal();
}

const NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function formatearFechaCorta(fechaIso) {
  const partes = fechaIso.split("-");
  const mes = Number(partes[1]) - 1;
  return { dia: partes[2], mes: NOMBRES_MES[mes] };
}

function escaparTexto(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}
