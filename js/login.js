document.addEventListener("DOMContentLoaded", function () {

  // Si el usuario ya tiene sesión iniciada, no tiene sentido mostrarle el
  // formulario de acceso otra vez.
  if (obtenerUsuarioActual()) {
    window.location.href = "index.html";
    return;
  }

  configurarPestanasDeAcceso();
  configurarFormularioIniciarSesion();
  configurarFormularioRegistro();
});

function configurarPestanasDeAcceso() {
  const tabIniciarSesion = document.getElementById("tab-iniciar-sesion");
  const tabRegistro = document.getElementById("tab-registro");
  const panelIniciarSesion = document.getElementById("panel-iniciar-sesion");
  const panelRegistro = document.getElementById("panel-registro");

  tabIniciarSesion.addEventListener("click", function () {
    activarPestana(tabIniciarSesion, panelIniciarSesion, tabRegistro, panelRegistro);
  });

  tabRegistro.addEventListener("click", function () {
    activarPestana(tabRegistro, panelRegistro, tabIniciarSesion, panelIniciarSesion);
  });
}

function activarPestana(tabActivo, panelActivo, tabInactivo, panelInactivo) {
  tabActivo.setAttribute("aria-selected", "true");
  tabInactivo.setAttribute("aria-selected", "false");
  panelActivo.hidden = false;
  panelInactivo.hidden = true;
}

function configurarFormularioIniciarSesion() {
  const formulario = document.getElementById("form-iniciar-sesion");
  const mensajeError = document.getElementById("mensaje-error-inicio");

  formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    ocultarMensaje(mensajeError);
    limpiarErroresDeCampos(formulario);

    const correo = document.getElementById("correo-inicio").value.trim();
    const password = document.getElementById("password-inicio").value;

    let formularioValido = true;

    if (!correo) {
      mostrarErrorDeCampo("error-correo-inicio", "Ingresa tu correo electrónico.");
      formularioValido = false;
    }
    if (!password) {
      mostrarErrorDeCampo("error-password-inicio", "Ingresa tu contraseña.");
      formularioValido = false;
    }
    if (!formularioValido) return;

    const botonEnviar = formulario.querySelector('button[type="submit"]');
    botonEnviar.disabled = true;

    try {
      const usuario = await Datos.verificarCredenciales(correo, password);
      if (!usuario) {
        mostrarMensaje(mensajeError, "El correo o la contraseña no son correctos.");
        return;
      }

      guardarSesion(usuario);

      // Si el usuario puede gestionar eventos, lo llevamos directo a
      // Administración; si es participante, a su agenda.
      if (puedeGestionarEventos(usuario)) {
        window.location.href = "admin.html";
      } else {
        window.location.href = "participante.html";
      }
    } catch (error) {
      mostrarMensaje(mensajeError, error.message);
    } finally {
      botonEnviar.disabled = false;
    }
  });
}

function configurarFormularioRegistro() {
  const formulario = document.getElementById("form-registro");
  const mensajeError = document.getElementById("mensaje-error-registro");

  formulario.addEventListener("submit", async function (evento) {
    evento.preventDefault();
    ocultarMensaje(mensajeError);
    limpiarErroresDeCampos(formulario);

    const nombre = document.getElementById("nombre-registro").value.trim();
    const correo = document.getElementById("correo-registro").value.trim();
    const password = document.getElementById("password-registro").value;
    const passwordConfirmar = document.getElementById("password-confirmar").value;

    const formularioValido = validarFormularioRegistro(nombre, correo, password, passwordConfirmar);
    if (!formularioValido) return;

    const botonEnviar = formulario.querySelector('button[type="submit"]');
    botonEnviar.disabled = true;

    try {
      const usuario = await Datos.registrarUsuario({ nombre: nombre, correo: correo, password: password });
      guardarSesion(usuario);
      window.location.href = "participante.html";
    } catch (error) {
      mostrarMensaje(mensajeError, error.message);
    } finally {
      botonEnviar.disabled = false;
    }
  });
}

function validarFormularioRegistro(nombre, correo, password, passwordConfirmar) {
  let valido = true;

  if (!nombre) {
    mostrarErrorDeCampo("error-nombre-registro", "Ingresa tu nombre completo.");
    valido = false;
  }

  if (!correo || !correoEsValido(correo)) {
    mostrarErrorDeCampo("error-correo-registro", "Ingresa un correo electrónico válido.");
    valido = false;
  }

  if (!password || password.length < 6) {
    mostrarErrorDeCampo("error-password-registro", "La contraseña debe tener al menos 6 caracteres.");
    valido = false;
  }

  if (password !== passwordConfirmar) {
    mostrarErrorDeCampo("error-password-confirmar", "Las contraseñas no coinciden.");
    valido = false;
  }

  return valido;
}

function correoEsValido(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

function mostrarErrorDeCampo(idSpan, texto) {
  const span = document.getElementById(idSpan);
  if (span) span.textContent = texto;
}

function limpiarErroresDeCampos(formulario) {
  formulario.querySelectorAll(".error").forEach(function (span) { span.textContent = ""; });
}

function mostrarMensaje(elemento, texto) {
  elemento.textContent = texto;
  elemento.hidden = false;
}

function ocultarMensaje(elemento) {
  elemento.hidden = true;
  elemento.textContent = "";
}
