const CLAVE_SESION = "eventosAcademicos_sesion";

function obtenerSesionCompleta() {
  const datosGuardados = sessionStorage.getItem(CLAVE_SESION);
  if (!datosGuardados) return null;
  try {
    return JSON.parse(datosGuardados);
  } catch (error) {
    return null;
  }
}

function obtenerUsuarioActual() {
  const sesion = obtenerSesionCompleta();
  return sesion ? sesion.usuario : null;
}

function obtenerToken() {
  const sesion = obtenerSesionCompleta();
  return sesion ? sesion.token : null;
}

function guardarSesion(usuario, token) {
  sessionStorage.setItem(CLAVE_SESION, JSON.stringify({ usuario: usuario, token: token }));
}

function cerrarSesion() {
  if (typeof Datos !== "undefined" && Datos.cerrarSesionBackend) {
    Datos.cerrarSesionBackend().catch(function () {});
  }
  sessionStorage.removeItem(CLAVE_SESION);
  window.location.href = "index.html";
}

function usuarioTieneRol(usuario, rol) {
  return !!usuario && Array.isArray(usuario.roles) && usuario.roles.includes(rol);
}

function esAdministrador(usuario) {
  return usuarioTieneRol(usuario, "ADMINISTRADOR");
}

function esOrganizador(usuario) {
  return usuarioTieneRol(usuario, "ORGANIZADOR");
}

function esParticipante(usuario) {
  return usuarioTieneRol(usuario, "PARTICIPANTE");
}

// RN-06: solo ADMINISTRADOR y ORGANIZADOR pueden gestionar eventos.
function puedeGestionarEventos(usuario) {
  return esAdministrador(usuario) || esOrganizador(usuario);
}

function nombresDeRoles(roles) {
  const nombres = {
    ADMINISTRADOR: "Administrador",
    ORGANIZADOR: "Organizador",
    PARTICIPANTE: "Participante"
  };
  return roles.map(function (rol) { return nombres[rol] || rol; }).join(", ");
}

// Actualiza la cabecera de cualquier página según si hay sesión iniciada y
// qué rol tiene el usuario (RN-08: los visitantes solo consultan
// información pública, así que no ven los enlaces privados).
function actualizarCabeceraSesion() {
  const usuario = obtenerUsuarioActual();

  const spanNombre = document.getElementById("nombre-usuario");
  const botonSalir = document.getElementById("btn-salir");
  const enlaceLogin = document.querySelector('header nav a[href="login.html"]');
  const enlaceAgenda = document.querySelector('header nav a[href="participante.html"]');
  const enlaceAdmin = document.querySelector('header nav a[href="admin.html"]');

  if (usuario) {
    if (spanNombre) spanNombre.textContent = usuario.nombre + " · " + nombresDeRoles(usuario.roles);
    if (botonSalir) botonSalir.hidden = false;
    if (enlaceLogin) enlaceLogin.parentElement.hidden = true;
    if (enlaceAgenda) enlaceAgenda.parentElement.hidden = !esParticipante(usuario) && !puedeGestionarEventos(usuario);
    if (enlaceAdmin) enlaceAdmin.parentElement.hidden = !puedeGestionarEventos(usuario);
  } else {
    if (spanNombre) spanNombre.textContent = "Visitante";
    if (botonSalir) botonSalir.hidden = true;
    if (enlaceLogin) enlaceLogin.parentElement.hidden = false;
    if (enlaceAgenda) enlaceAgenda.parentElement.hidden = true;
    if (enlaceAdmin) enlaceAdmin.parentElement.hidden = true;
  }

  if (botonSalir && !botonSalir.dataset.conEvento) {
    botonSalir.addEventListener("click", cerrarSesion);
    botonSalir.dataset.conEvento = "si";
  }
}

function exigirSesion(rolesPermitidos) {
  const usuario = obtenerUsuarioActual();

  if (!usuario) {
    window.location.href = "login.html";
    return null;
  }

  if (rolesPermitidos && rolesPermitidos.length > 0) {
    const tienePermiso = rolesPermitidos.some(function (rol) { return usuarioTieneRol(usuario, rol); });
    if (!tienePermiso) {
      alert("No tienes permisos para acceder a esta sección.");
      window.location.href = "index.html";
      return null;
    }
  }

  return usuario;
}

document.addEventListener("DOMContentLoaded", actualizarCabeceraSesion);