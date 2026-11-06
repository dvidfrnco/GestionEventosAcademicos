const URL_BASE = "http://localhost:8080";

const ESTADOS_EVENTO = {
  BORRADOR: "BORRADOR",
  PUBLICADO: "PUBLICADO",
  CERRADO: "CERRADO",
  CANCELADO: "CANCELADO",
  FINALIZADO: "FINALIZADO"
};

const ESTADOS_INSCRIPCION = {
  ACTIVA: "ACTIVA",
  CANCELADA: "CANCELADA"
};

const ESTADOS_ASISTENCIA = {
  ASISTIO: "ASISTIO",
  NO_ASISTIO: "NO_ASISTIO"
};

const ROLES_DISPONIBLES = ["ADMINISTRADOR", "ORGANIZADOR", "PARTICIPANTE"];
const CLAVE_TOKEN = "eventosAcademicos_token";


function guardarToken(token) {
  sessionStorage.setItem(CLAVE_TOKEN, token);
}

function obtenerTokenGuardado() {
  return sessionStorage.getItem(CLAVE_TOKEN);
}

function borrarTokenGuardado() {
  sessionStorage.removeItem(CLAVE_TOKEN);
}

async function peticion(ruta, opciones) {
  opciones = opciones || {};
  const encabezados = Object.assign({ "Content-Type": "application/json" }, opciones.headers || {});

  const token = obtenerTokenGuardado();
  if (token) {
    encabezados["Authorization"] = "Bearer " + token;
  }

  const respuesta = await fetch(URL_BASE + ruta, Object.assign({}, opciones, { headers: encabezados }));

  if (respuesta.status === 204) return null;

  const texto = await respuesta.text();
  const cuerpo = texto ? JSON.parse(texto) : null;

  if (!respuesta.ok) {
    const mensaje = (cuerpo && cuerpo.mensaje) ? cuerpo.mensaje : "Ocurrió un error inesperado (código " + respuesta.status + ").";
    throw new Error(mensaje);
  }

  return cuerpo;
}

function adaptarUsuario(dto) {
  if (!dto) return null;
  return { id: dto.id, nombre: dto.nombre, correo: dto.email, estado: dto.estado, roles: dto.roles };
}

function quitarSegundos(horaConSegundos) {
  return horaConSegundos ? horaConSegundos.substring(0, 5) : horaConSegundos;
}

function adaptarEvento(dto) {
  if (!dto) return null;
  return {
    id: dto.id,
    titulo: dto.titulo,
    descripcion: dto.descripcion,
    categoriaId: dto.categoriaId,
    categoriaNombre: dto.categoriaNombre,
    modalidad: dto.modalidad,
    fecha: dto.fecha,
    horaInicio: quitarSegundos(dto.horaInicio),
    horaFin: quitarSegundos(dto.horaFin),
    ubicacion: dto.ubicacion,
    cupo: dto.cupo,
    estado: dto.estado,
    estadoEfectivo: dto.estado,
    motivoCancelacion: dto.motivoCancelacion,
    organizadorId: dto.organizadorId,
    organizadorNombre: dto.organizadorNombre,
    cuposDisponibles: dto.cuposDisponibles
  };
}

function adaptarInscripcion(dto) {
  if (!dto) return null;
  return {
    id: dto.id,
    eventoId: dto.eventoId,
    eventoTitulo: dto.eventoTitulo,
    usuarioId: dto.usuarioId,
    usuarioNombre: dto.usuarioNombre,
    usuarioCorreo: dto.usuarioEmail,
    fechaInscripcion: dto.fechaInscripcion,
    estado: dto.estado,
    estadoAsistencia: dto.estadoAsistencia
  };
}

function adaptarAsistencia(dto) {
  if (!dto) return null;
  return { id: dto.id, inscripcionId: dto.inscripcionId, estadoAsistencia: dto.estadoAsistencia };
}

function obtenerFechaHoraInicio(evento) {
  return new Date(evento.fecha + "T" + evento.horaInicio + ":00");
}

function obtenerFechaHoraFin(evento) {
  return new Date(evento.fecha + "T" + evento.horaFin + ":00");
}

function calcularEstadoEfectivo(evento) {
  if (evento.estado === ESTADOS_EVENTO.CANCELADO) return ESTADOS_EVENTO.CANCELADO;
  const yaTermino = obtenerFechaHoraFin(evento) < new Date();
  const estaPublicoOCerrado = evento.estado === ESTADOS_EVENTO.PUBLICADO || evento.estado === ESTADOS_EVENTO.CERRADO;
  if (yaTermino && estaPublicoOCerrado) return ESTADOS_EVENTO.FINALIZADO;
  return evento.estado;
}

function eventoAceptaInscripciones(evento) {
  const estadoEfectivo = calcularEstadoEfectivo(evento);
  if (estadoEfectivo !== ESTADOS_EVENTO.PUBLICADO) return false;
  return new Date() < obtenerFechaHoraInicio(evento);
}

function evantoPermiteCancelarInscripcion(evento) {
  return new Date() < obtenerFechaHoraInicio(evento);
}

function validarDatosEvento(datosEvento) {
  if (!datosEvento.titulo || !datosEvento.descripcion || !datosEvento.categoriaId ||
      !datosEvento.modalidad || !datosEvento.fecha || !datosEvento.horaInicio ||
      !datosEvento.horaFin || !datosEvento.ubicacion || !datosEvento.cupo) {
    throw new Error("Todos los campos del evento son obligatorios.");
  }
  if (Number(datosEvento.cupo) <= 0) {
    throw new Error("El cupo máximo debe ser mayor que cero.");
  }
  if (datosEvento.horaFin <= datosEvento.horaInicio) {
    throw new Error("La hora de fin debe ser posterior a la hora de inicio.");
  }
}

function construirEventoRequest(datosEvento) {
  return {
    titulo: datosEvento.titulo,
    descripcion: datosEvento.descripcion,
    categoriaId: Number(datosEvento.categoriaId),
    modalidad: datosEvento.modalidad,
    fecha: datosEvento.fecha,
    horaInicio: datosEvento.horaInicio,
    horaFin: datosEvento.horaFin,
    ubicacion: datosEvento.ubicacion,
    cupo: Number(datosEvento.cupo)
  };
}

async function obtenerUsuarios() {
  const usuarios = await peticion("/api/usuarios", { method: "GET" });
  return usuarios.map(adaptarUsuario);
}

async function obtenerUsuarioPorId(idUsuario) {
  try {
    const usuario = await peticion("/api/usuarios/" + idUsuario, { method: "GET" });
    return adaptarUsuario(usuario);
  } catch (error) {
    return null;
  }
}

async function buscarUsuarios(filtros) {
  filtros = filtros || {};
  const parametros = new URLSearchParams();
  if (filtros.texto) parametros.set("texto", filtros.texto);
  if (filtros.rol) parametros.set("rol", filtros.rol);

  const cadena = parametros.toString();
  const usuarios = await peticion("/api/usuarios" + (cadena ? "?" + cadena : ""), { method: "GET" });
  return usuarios.map(adaptarUsuario);
}

async function registrarUsuario(datosRegistro) {
  const resultado = await peticion("/api/auth/registro", {
    method: "POST",
    body: JSON.stringify({ nombre: datosRegistro.nombre, email: datosRegistro.correo, password: datosRegistro.password })
  });
  guardarToken(resultado.token);
  return adaptarUsuario(resultado.usuario);
}

async function verificarCredenciales(correo, password) {
  const resultado = await peticion("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: correo, password: password })
  });
  guardarToken(resultado.token);
  return adaptarUsuario(resultado.usuario);
}

async function cerrarSesionBackend() {
  const token = obtenerTokenGuardado();
  if (!token) return;
  try {
    await fetch(URL_BASE + "/api/auth/logout", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token }
    });
  } finally {
    borrarTokenGuardado();
  }
}

async function actualizarRolesUsuario(idUsuario, nuevosRoles) {
  const resultado = await peticion("/api/usuarios/" + idUsuario + "/roles", {
    method: "PATCH",
    body: JSON.stringify({ roles: nuevosRoles })
  });
  return adaptarUsuario(resultado);
}

async function actualizarEstadoUsuario(idUsuario, nuevoEstado) {
  const resultado = await peticion("/api/usuarios/" + idUsuario + "/estado", {
    method: "PATCH",
    body: JSON.stringify({ estado: nuevoEstado })
  });
  return adaptarUsuario(resultado);
}

async function obtenerCategorias() {
  return await peticion("/api/categorias", { method: "GET" });
}

async function obtenerCategoriasActivas() {
  return await peticion("/api/categorias/activas", { method: "GET" });
}

async function crearCategoria(nombre) {
  return await peticion("/api/categorias", { method: "POST", body: JSON.stringify({ nombre: nombre }) });
}

async function cambiarEstadoCategoria(idCategoria, nuevoEstado) {
  return await peticion("/api/categorias/" + idCategoria + "/estado", {
    method: "PATCH",
    body: JSON.stringify({ estado: nuevoEstado })
  });
}

async function obtenerEventos() {
  const eventos = await peticion("/api/eventos", { method: "GET" });
  return eventos.map(adaptarEvento);
}

async function obtenerEventoPorId(idEvento) {
  try {
    const evento = await peticion("/api/eventos/" + idEvento, { method: "GET" });
    return adaptarEvento(evento);
  } catch (error) {
    return null;
  }
}

async function obtenerEventosPublicadosFiltrados(filtros) {
  filtros = filtros || {};
  const parametros = new URLSearchParams();
  if (filtros.texto) parametros.set("texto", filtros.texto);
  if (filtros.categoriaId) parametros.set("categoriaId", filtros.categoriaId);
  if (filtros.modalidad) parametros.set("modalidad", filtros.modalidad);
  if (filtros.fecha) parametros.set("fecha", filtros.fecha);

  const cadena = parametros.toString();
  const eventos = await peticion("/api/eventos/publicados" + (cadena ? "?" + cadena : ""), { method: "GET" });
  return eventos.map(adaptarEvento);
}

async function obtenerCuposDisponibles(idEvento) {
  const evento = await obtenerEventoPorId(idEvento);
  return evento ? evento.cuposDisponibles : 0;
}

async function crearEvento(datosEvento, idOrganizador) {
  validarDatosEvento(datosEvento);
  const creado = await peticion("/api/eventos", { method: "POST", body: JSON.stringify(construirEventoRequest(datosEvento)) });
  return adaptarEvento(creado);
}

async function actualizarEvento(idEvento, datosEvento, idUsuario) {
  validarDatosEvento(datosEvento);
  const actualizado = await peticion("/api/eventos/" + idEvento, { method: "PUT", body: JSON.stringify(construirEventoRequest(datosEvento)) });
  return adaptarEvento(actualizado);
}

async function cambiarEstadoEvento(idEvento, nuevoEstado, idUsuario, motivo) {
  const actualizado = await peticion("/api/eventos/" + idEvento + "/estado", {
    method: "PATCH",
    body: JSON.stringify({ estado: nuevoEstado, motivo: motivo || null })
  });
  return adaptarEvento(actualizado);
}

async function obtenerInscripcionesPorUsuario(idUsuario) {
  const inscripciones = await peticion("/api/inscripciones/mias", { method: "GET" });
  return inscripciones.map(adaptarInscripcion);
}

async function obtenerInscripcionesPorEvento(idEvento) {
  const inscripciones = await peticion("/api/eventos/" + idEvento + "/inscripciones", { method: "GET" });
  return inscripciones.map(adaptarInscripcion);
}

async function crearInscripcion(idEvento, idUsuario) {
  const creada = await peticion("/api/eventos/" + idEvento + "/inscripciones", { method: "POST" });
  return adaptarInscripcion(creada);
}

async function cancelarInscripcion(idInscripcion, idUsuario) {
  const cancelada = await peticion("/api/inscripciones/" + idInscripcion + "/cancelar", { method: "PATCH" });
  return adaptarInscripcion(cancelada);
}

async function obtenerAsistenciaPorInscripcion(idInscripcion) {
  const resultado = await peticion("/api/inscripciones/" + idInscripcion + "/asistencia", { method: "GET" });
  return adaptarAsistencia(resultado);
}

async function registrarAsistencia(idInscripcion, estadoAsistencia, idUsuarioRegistra) {
  const resultado = await peticion("/api/inscripciones/" + idInscripcion + "/asistencia", {
    method: "PATCH",
    body: JSON.stringify({ estadoAsistencia: estadoAsistencia })
  });
  return adaptarAsistencia(resultado);
}

async function obtenerAuditoria() {
  const registros = await peticion("/api/auditoria", { method: "GET" });
  return registros.map(function (r) {
    return { id: r.id, usuarioId: r.idUsuario, accion: r.accion, entidad: r.entidad, idReferencia: r.idReferencia, fecha: r.fecha };
  });
}

async function obtenerIndicadoresEvento(idEvento) {
  return await peticion("/api/eventos/" + idEvento + "/indicadores", { method: "GET" });
}

async function obtenerIndicadoresGenerales() {
  const eventos = await obtenerEventos();
  const listaIndicadores = await Promise.all(eventos.map(function (evento) { return obtenerIndicadoresEvento(evento.id); }));

  let inscritos = 0, asistieron = 0, noAsistieron = 0, cupoTotal = 0;
  eventos.forEach(function (evento, indice) {
    inscritos += listaIndicadores[indice].inscritos;
    asistieron += listaIndicadores[indice].asistieron;
    noAsistieron += listaIndicadores[indice].noAsistieron;
    cupoTotal += evento.cupo;
  });

  return {
    inscritos: inscritos,
    cuposDisponibles: Math.max(cupoTotal - inscritos, 0),
    porcentajeOcupacion: cupoTotal > 0 ? Math.round((inscritos / cupoTotal) * 100) : 0,
    asistieron: asistieron,
    noAsistieron: noAsistieron
  };
}

const Datos = {
  ESTADOS_EVENTO: ESTADOS_EVENTO,
  ESTADOS_INSCRIPCION: ESTADOS_INSCRIPCION,
  ESTADOS_ASISTENCIA: ESTADOS_ASISTENCIA,
  ROLES_DISPONIBLES: ROLES_DISPONIBLES,

  calcularEstadoEfectivo: calcularEstadoEfectivo,
  eventoAceptaInscripciones: eventoAceptaInscripciones,
  evantoPermiteCancelarInscripcion: evantoPermiteCancelarInscripcion,

  obtenerUsuarios: obtenerUsuarios,
  obtenerUsuarioPorId: obtenerUsuarioPorId,
  buscarUsuarios: buscarUsuarios,
  registrarUsuario: registrarUsuario,
  verificarCredenciales: verificarCredenciales,
  cerrarSesionBackend: cerrarSesionBackend,
  actualizarRolesUsuario: actualizarRolesUsuario,
  actualizarEstadoUsuario: actualizarEstadoUsuario,

  obtenerCategorias: obtenerCategorias,
  obtenerCategoriasActivas: obtenerCategoriasActivas,
  crearCategoria: crearCategoria,
  cambiarEstadoCategoria: cambiarEstadoCategoria,

  obtenerEventos: obtenerEventos,
  obtenerEventoPorId: obtenerEventoPorId,
  obtenerEventosPublicadosFiltrados: obtenerEventosPublicadosFiltrados,
  obtenerCuposDisponibles: obtenerCuposDisponibles,
  crearEvento: crearEvento,
  actualizarEvento: actualizarEvento,
  cambiarEstadoEvento: cambiarEstadoEvento,

  obtenerInscripcionesPorUsuario: obtenerInscripcionesPorUsuario,
  obtenerInscripcionesPorEvento: obtenerInscripcionesPorEvento,
  crearInscripcion: crearInscripcion,
  cancelarInscripcion: cancelarInscripcion,

  obtenerAsistenciaPorInscripcion: obtenerAsistenciaPorInscripcion,
  registrarAsistencia: registrarAsistencia,

  obtenerAuditoria: obtenerAuditoria,
  obtenerIndicadoresEvento: obtenerIndicadoresEvento,
  obtenerIndicadoresGenerales: obtenerIndicadoresGenerales
};