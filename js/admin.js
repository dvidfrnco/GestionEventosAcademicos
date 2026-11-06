let usuarioActual = null;
let esAdmin = false;

let categoriasCache = [];
let eventoIdEnEdicion = null;
let eventoIdACancelar = null;


document.addEventListener("DOMContentLoaded", async function () {
  usuarioActual = exigirSesion(["ADMINISTRADOR", "ORGANIZADOR"]);
  if (!usuarioActual) return;

  esAdmin = esAdministrador(usuarioActual);

  ajustarPestanasSegunRol();
  configurarPestanasAdmin();

  categoriasCache = await Datos.obtenerCategorias();

  configurarPanelEventos();
  configurarPanelCategorias();
  configurarPanelUsuarios();
  configurarPanelAsistencia();
  configurarPanelReportes();

  await cargarTablaEventos();
});

function ajustarPestanasSegunRol() {
  // RF-08 y RF-01: solo el administrador gestiona categorías y usuarios.
  if (!esAdmin) {
    document.getElementById("tab-categorias").hidden = true;
    document.getElementById("tab-usuarios").hidden = true;
  }
}

function configurarPestanasAdmin() {
  const pestanas = [
    { boton: "tab-eventos", panel: "panel-eventos" },
    { boton: "tab-categorias", panel: "panel-categorias" },
    { boton: "tab-usuarios", panel: "panel-usuarios" },
    { boton: "tab-asistencia", panel: "panel-asistencia" },
    { boton: "tab-reportes", panel: "panel-reportes" }
  ];

  pestanas.forEach(function (actual) {
    const boton = document.getElementById(actual.boton);
    boton.addEventListener("click", async function () {
      pestanas.forEach(function (otra) {
        document.getElementById(otra.boton).setAttribute("aria-selected", otra.boton === actual.boton ? "true" : "false");
        document.getElementById(otra.panel).hidden = otra.boton !== actual.boton;
      });

      if (actual.panel === "panel-categorias") await cargarTablaCategorias();
      if (actual.panel === "panel-usuarios") await cargarTablaUsuarios();
      if (actual.panel === "panel-asistencia") await cargarSelectEventosAsistencia();
      if (actual.panel === "panel-reportes") await cargarSelectEventosReportes();
    });
  });
}

async function obtenerEventosSegunRol() {
  const eventos = await Datos.obtenerEventos();
  if (esAdmin) return eventos;
  return eventos.filter(function (evento) { return evento.organizadorId === usuarioActual.id; });
}

function nombreCategoria(idCategoria) {
  const categoria = categoriasCache.find(function (c) { return c.id === idCategoria; });
  return categoria ? categoria.nombre : "";
}

function configurarPanelEventos() {
  document.getElementById("btn-nuevo-evento").addEventListener("click", function () {
    abrirFormularioEvento(null);
  });

  document.getElementById("form-evento").addEventListener("submit", guardarFormularioEvento);
  document.getElementById("btn-cancelar-form-evento").addEventListener("click", function () {
    document.getElementById("dialogo-evento").close();
  });

  document.getElementById("form-cancelar-evento").addEventListener("submit", confirmarCancelarEvento);
  document.getElementById("btn-mantener-evento").addEventListener("click", function () {
    document.getElementById("dialogo-cancelar-evento").close();
  });
}

async function cargarTablaEventos() {
  const eventos = await obtenerEventosSegunRol();
  eventos.sort(function (a, b) { return (b.fecha + b.horaInicio).localeCompare(a.fecha + a.horaInicio); });

  const cuerpo = document.getElementById("cuerpo-tabla-eventos");
  cuerpo.innerHTML = "";

  eventos.forEach(function (evento) {
    cuerpo.appendChild(crearFilaEvento(evento));
  });
}

function crearFilaEvento(evento) {
  const fila = document.createElement("tr");

  fila.innerHTML =
    "<td>" + escaparTexto(evento.titulo) + "</td>" +
    "<td>" + escaparTexto(nombreCategoria(evento.categoriaId)) + "</td>" +
    "<td>" + evento.fecha + "</td>" +
    "<td>" + (evento.modalidad === "VIRTUAL" ? "Virtual" : "Presencial") + "</td>" +
    "<td>" + evento.cupo + "</td>" +
    '<td><span class="estado" data-estado="' + evento.estadoEfectivo + '">' + formatearEstadoEvento(evento.estadoEfectivo) + "</span></td>" +
    "<td></td>";

  const celdaAcciones = fila.lastElementChild;
  const puedeEditar = evento.estadoEfectivo === "BORRADOR" || evento.estadoEfectivo === "PUBLICADO";
  const puedePublicar = evento.estadoEfectivo === "BORRADOR";
  const puedeCerrar = evento.estadoEfectivo === "PUBLICADO";
  const puedeCancelar = evento.estadoEfectivo === "BORRADOR" || evento.estadoEfectivo === "PUBLICADO" || evento.estadoEfectivo === "CERRADO";

  if (puedeEditar) {
    celdaAcciones.appendChild(crearBotonAccion("Editar", function () { abrirFormularioEvento(evento); }));
  }
  if (puedePublicar) {
    celdaAcciones.appendChild(crearBotonAccion("Publicar", function () { cambiarEstadoDesdeListado(evento.id, "PUBLICADO"); }));
  }
  if (puedeCerrar) {
    celdaAcciones.appendChild(crearBotonAccion("Cerrar", function () { cambiarEstadoDesdeListado(evento.id, "CERRADO"); }));
  }
  if (puedeCancelar) {
    celdaAcciones.appendChild(crearBotonAccion("Cancelar", function () { abrirDialogoCancelarEvento(evento.id); }, "boton-peligro"));
  }

  return fila;
}

function crearBotonAccion(texto, alHacerClic, clase) {
  const boton = document.createElement("button");
  boton.type = "button";
  boton.textContent = texto;
  if (clase) boton.className = clase;
  boton.addEventListener("click", alHacerClic);
  return boton;
}

async function cambiarEstadoDesdeListado(idEvento, nuevoEstado) {
  try {
    await Datos.cambiarEstadoEvento(idEvento, nuevoEstado, usuarioActual.id, null);
    await cargarTablaEventos();
  } catch (error) {
    alert(error.message);
  }
}

function abrirFormularioEvento(evento) {
  const dialogo = document.getElementById("dialogo-evento");
  const formulario = document.getElementById("form-evento");
  formulario.reset();
  ocultarMensaje(document.getElementById("mensaje-error-evento"));

  llenarSelectCategorias();

  eventoIdEnEdicion = evento ? evento.id : null;
  document.getElementById("dialogo-evento-titulo").textContent = evento ? "Editar evento" : "Crear evento";

  if (evento) {
    document.getElementById("evento-titulo").value = evento.titulo;
    document.getElementById("evento-descripcion").value = evento.descripcion;
    document.getElementById("evento-categoria").value = evento.categoriaId;
    document.getElementById("evento-modalidad").value = evento.modalidad;
    document.getElementById("evento-fecha").value = evento.fecha;
    document.getElementById("evento-hora-inicio").value = evento.horaInicio;
    document.getElementById("evento-hora-fin").value = evento.horaFin;
    document.getElementById("evento-ubicacion").value = evento.ubicacion;
    document.getElementById("evento-cupo").value = evento.cupo;
  }

  dialogo.showModal();
}

function llenarSelectCategorias() {
  const select = document.getElementById("evento-categoria");
  const categoriasActivas = categoriasCache.filter(function (c) { return c.estado === "ACTIVA"; });

  select.innerHTML = '<option value="">Selecciona una categoría</option>';
  categoriasActivas.forEach(function (categoria) {
    const opcion = document.createElement("option");
    opcion.value = categoria.id;
    opcion.textContent = categoria.nombre;
    select.appendChild(opcion);
  });
}

async function guardarFormularioEvento(evento) {
  evento.preventDefault();
  const mensajeError = document.getElementById("mensaje-error-evento");
  ocultarMensaje(mensajeError);

  const datosEvento = {
    titulo: document.getElementById("evento-titulo").value.trim(),
    descripcion: document.getElementById("evento-descripcion").value.trim(),
    categoriaId: document.getElementById("evento-categoria").value,
    modalidad: document.getElementById("evento-modalidad").value,
    fecha: document.getElementById("evento-fecha").value,
    horaInicio: document.getElementById("evento-hora-inicio").value,
    horaFin: document.getElementById("evento-hora-fin").value,
    ubicacion: document.getElementById("evento-ubicacion").value.trim(),
    cupo: document.getElementById("evento-cupo").value
  };

  try {
    if (eventoIdEnEdicion) {
      await Datos.actualizarEvento(eventoIdEnEdicion, datosEvento, usuarioActual.id);
    } else {
      await Datos.crearEvento(datosEvento, usuarioActual.id);
    }
    document.getElementById("dialogo-evento").close();
    await cargarTablaEventos();
  } catch (error) {
    mostrarMensaje(mensajeError, error.message);
  }
}

function abrirDialogoCancelarEvento(idEvento) {
  eventoIdACancelar = idEvento;
  document.getElementById("form-cancelar-evento").reset();
  document.getElementById("dialogo-cancelar-evento").showModal();
}

async function confirmarCancelarEvento(evento) {
  evento.preventDefault();
  const motivo = document.getElementById("motivo-cancelacion").value.trim();

  try {
    await Datos.cambiarEstadoEvento(eventoIdACancelar, "CANCELADO", usuarioActual.id, motivo);
    document.getElementById("dialogo-cancelar-evento").close();
    eventoIdACancelar = null;
    await cargarTablaEventos();
  } catch (error) {
    alert(error.message);
  }
}

function configurarPanelCategorias() {
  if (!esAdmin) return;

  document.getElementById("form-categoria").addEventListener("submit", async function (evento) {
    evento.preventDefault();
    const campoNombre = document.getElementById("categoria-nombre");
    const nombre = campoNombre.value.trim();
    if (!nombre) return;

    try {
      await Datos.crearCategoria(nombre);
      campoNombre.value = "";
      categoriasCache = await Datos.obtenerCategorias();
      await cargarTablaCategorias();
    } catch (error) {
      alert(error.message);
    }
  });
}

async function cargarTablaCategorias() {
  if (!esAdmin) return;
  const categorias = await Datos.obtenerCategorias();
  const cuerpo = document.getElementById("cuerpo-tabla-categorias");
  cuerpo.innerHTML = "";

  categorias.forEach(function (categoria) {
    const fila = document.createElement("tr");
    fila.innerHTML =
      "<td>" + escaparTexto(categoria.nombre) + "</td>" +
      '<td><span class="estado" data-estado="' + categoria.estado + '">' + (categoria.estado === "ACTIVA" ? "Activa" : "Inactiva") + "</span></td>" +
      "<td></td>";

    const celdaAcciones = fila.lastElementChild;
    const nuevoEstado = categoria.estado === "ACTIVA" ? "INACTIVA" : "ACTIVA";
    celdaAcciones.appendChild(crearBotonAccion(categoria.estado === "ACTIVA" ? "Desactivar" : "Activar", async function () {
      await Datos.cambiarEstadoCategoria(categoria.id, nuevoEstado);
      categoriasCache = await Datos.obtenerCategorias();
      await cargarTablaCategorias();
    }));

    cuerpo.appendChild(fila);
  });
}

function configurarPanelUsuarios() {
  if (!esAdmin) return;

  document.getElementById("form-filtro-usuarios").addEventListener("submit", async function (evento) {
    evento.preventDefault();
    await cargarTablaUsuarios();
  });
}

async function cargarTablaUsuarios() {
  if (!esAdmin) return;

  const filtros = {
    texto: document.getElementById("usuarios-buscar").value.trim(),
    rol: document.getElementById("usuarios-rol").value
  };

  const usuarios = await Datos.buscarUsuarios(filtros);
  const cuerpo = document.getElementById("cuerpo-tabla-usuarios");
  cuerpo.innerHTML = "";

  usuarios.forEach(function (usuario) {
    cuerpo.appendChild(crearFilaUsuario(usuario));
  });
}

function crearFilaUsuario(usuario) {
  const fila = document.createElement("tr");
  fila.innerHTML =
    "<td>" + escaparTexto(usuario.nombre) + "</td>" +
    "<td>" + escaparTexto(usuario.correo) + "</td>" +
    "<td>" + usuario.roles.map(formatearRol).join(", ") + "</td>" +
    '<td><span class="estado" data-estado="' + usuario.estado + '">' + (usuario.estado === "ACTIVO" ? "Activo" : "Inactivo") + "</span></td>" +
    "<td></td>";

  const celdaAcciones = fila.lastElementChild;
  const esUnoMismo = usuario.id === usuarioActual.id;

  if (!esUnoMismo) {
    const tieneOrganizador = usuario.roles.includes("ORGANIZADOR");
    celdaAcciones.appendChild(crearBotonAccion(
      tieneOrganizador ? "Quitar Organizador" : "Hacer Organizador",
      async function () { await alternarRol(usuario, "ORGANIZADOR"); }
    ));

    const nuevoEstado = usuario.estado === "ACTIVO" ? "INACTIVO" : "ACTIVO";
    celdaAcciones.appendChild(crearBotonAccion(
      usuario.estado === "ACTIVO" ? "Desactivar" : "Activar",
      async function () {
        await Datos.actualizarEstadoUsuario(usuario.id, nuevoEstado);
        await cargarTablaUsuarios();
      }
    ));
  } else {
    celdaAcciones.textContent = "—";
  }

  return fila;
}

async function alternarRol(usuario, rol) {
  const rolesActuales = usuario.roles.slice();
  const indice = rolesActuales.indexOf(rol);
  if (indice >= 0) {
    rolesActuales.splice(indice, 1);
  } else {
    rolesActuales.push(rol);
  }

  try {
    await Datos.actualizarRolesUsuario(usuario.id, rolesActuales);
    await cargarTablaUsuarios();
  } catch (error) {
    alert(error.message);
  }
}

function formatearRol(rol) {
  const nombres = { ADMINISTRADOR: "Administrador", ORGANIZADOR: "Organizador", PARTICIPANTE: "Participante" };
  return nombres[rol] || rol;
}

function configurarPanelAsistencia() {
  document.getElementById("asistencia-evento").addEventListener("change", async function (evento) {
    await cargarTablaInscritos(evento.target.value ? Number(evento.target.value) : null);
  });
}

async function cargarSelectEventosAsistencia() {
  const eventos = await obtenerEventosSegunRol();
  const select = document.getElementById("asistencia-evento");
  const valorAnterior = select.value;

  select.innerHTML = '<option value="">Selecciona un evento</option>';
  eventos.forEach(function (evento) {
    const opcion = document.createElement("option");
    opcion.value = evento.id;
    opcion.textContent = evento.titulo + " — " + evento.fecha;
    select.appendChild(opcion);
  });

  select.value = valorAnterior;
  await cargarTablaInscritos(valorAnterior ? Number(valorAnterior) : null);
}

async function cargarTablaInscritos(idEvento) {
  const cuerpo = document.getElementById("cuerpo-tabla-inscritos");
  cuerpo.innerHTML = "";
  if (!idEvento) return;

  const inscripciones = await Datos.obtenerInscripcionesPorEvento(idEvento);

  const filas = await Promise.all(inscripciones.map(async function (inscripcion) {
    const participante = await Datos.obtenerUsuarioPorId(inscripcion.usuarioId);
    const asistencia = await Datos.obtenerAsistenciaPorInscripcion(inscripcion.id);
    return crearFilaInscrito(inscripcion, participante, asistencia);
  }));

  filas.forEach(function (fila) { cuerpo.appendChild(fila); });
}

function crearFilaInscrito(inscripcion, participante, asistencia) {
  const fila = document.createElement("tr");
  const esActiva = inscripcion.estado === "ACTIVA";

  fila.innerHTML =
    "<td>" + escaparTexto(participante ? participante.nombre : "") + "</td>" +
    "<td>" + escaparTexto(participante ? participante.correo : "") + "</td>" +
    '<td><span class="estado" data-estado="' + inscripcion.estado + '">' + (esActiva ? "Activa" : "Cancelada") + "</span></td>" +
    "<td></td>";

  const celdaAsistencia = fila.lastElementChild;

  if (!esActiva) {
    celdaAsistencia.textContent = "No aplica";
    return fila;
  }

  const estadoActual = asistencia ? asistencia.estadoAsistencia : null;

  const botonAsistio = crearBotonAccion("Asistió", async function () {
    await Datos.registrarAsistencia(inscripcion.id, "ASISTIO", usuarioActual.id);
    await cargarTablaInscritos(inscripcion.eventoId);
  });
  const botonNoAsistio = crearBotonAccion("No asistió", async function () {
    await Datos.registrarAsistencia(inscripcion.id, "NO_ASISTIO", usuarioActual.id);
    await cargarTablaInscritos(inscripcion.eventoId);
  });

  if (estadoActual === "ASISTIO") botonAsistio.disabled = true;
  if (estadoActual === "NO_ASISTIO") botonNoAsistio.disabled = true;

  celdaAsistencia.appendChild(botonAsistio);
  celdaAsistencia.appendChild(botonNoAsistio);

  return fila;
}

function configurarPanelReportes() {
  document.getElementById("reportes-evento").addEventListener("change", async function (evento) {
    await mostrarIndicadores(evento.target.value ? Number(evento.target.value) : null);
  });
}

async function cargarSelectEventosReportes() {
  const eventos = await obtenerEventosSegunRol();
  const select = document.getElementById("reportes-evento");
  const valorAnterior = select.value;

  select.innerHTML = '<option value="">Todos los eventos</option>';
  eventos.forEach(function (evento) {
    const opcion = document.createElement("option");
    opcion.value = evento.id;
    opcion.textContent = evento.titulo + " — " + evento.fecha;
    select.appendChild(opcion);
  });

  select.value = valorAnterior;
  await mostrarIndicadores(valorAnterior ? Number(valorAnterior) : null);

  const tablaAuditoria = document.getElementById("tabla-auditoria");
  tablaAuditoria.hidden = !esAdmin;
  if (esAdmin) await cargarTablaAuditoria();
}

async function mostrarIndicadores(idEvento) {
  const eventos = await obtenerEventosSegunRol();
  const eventosAConsiderar = idEvento ? eventos.filter(function (e) { return e.id === idEvento; }) : eventos;

  let inscritos = 0;
  let asistieron = 0;
  let noAsistieron = 0;
  let cupoTotal = 0;

  const indicadoresPorEvento = await Promise.all(
    eventosAConsiderar.map(function (evento) { return Datos.obtenerIndicadoresEvento(evento.id); })
  );

  eventosAConsiderar.forEach(function (evento, indice) {
    const indicadores = indicadoresPorEvento[indice];
    inscritos += indicadores.inscritos;
    asistieron += indicadores.asistieron;
    noAsistieron += indicadores.noAsistieron;
    cupoTotal += evento.cupo;
  });

  const cuposDisponibles = Math.max(cupoTotal - inscritos, 0);
  const porcentajeOcupacion = cupoTotal > 0 ? Math.round((inscritos / cupoTotal) * 100) : 0;

  document.getElementById("indicador-inscritos").textContent = inscritos;
  document.getElementById("indicador-cupos-disponibles").textContent = cuposDisponibles;
  document.getElementById("indicador-ocupacion").textContent = porcentajeOcupacion + "%";
  document.getElementById("indicador-asistencia").textContent = asistieron + " asistieron / " + noAsistieron + " no asistieron";
}

async function cargarTablaAuditoria() {
  const registros = await Datos.obtenerAuditoria();
  const cuerpo = document.getElementById("cuerpo-tabla-auditoria");
  cuerpo.innerHTML = "";

  const filas = await Promise.all(registros.map(async function (registro) {
    const usuarioRegistro = await Datos.obtenerUsuarioPorId(registro.usuarioId);
    const fila = document.createElement("tr");
    fila.innerHTML =
      "<td>" + new Date(registro.fecha).toLocaleString("es-CO") + "</td>" +
      "<td>" + escaparTexto(usuarioRegistro ? usuarioRegistro.nombre : "Desconocido") + "</td>" +
      "<td>" + escaparTexto(registro.accion) + "</td>" +
      "<td>" + escaparTexto(registro.entidad) + " #" + registro.idReferencia + "</td>";
    return fila;
  }));

  filas.forEach(function (fila) { cuerpo.appendChild(fila); });
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

function mostrarMensaje(elemento, texto) {
  elemento.textContent = texto;
  elemento.hidden = false;
}

function ocultarMensaje(elemento) {
  elemento.hidden = true;
  elemento.textContent = "";
}

function escaparTexto(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}
