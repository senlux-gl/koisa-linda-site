(function () {
  'use strict';
  const video = document.getElementById('kl-vsl');
  const button = document.getElementById('kl-vsl-sound');
  const status = document.getElementById('kl-vsl-status');
  if (!video || !button || !status) return;
  // Keep campaign parameters when the public build expands fragment links.
  document.querySelectorAll('a[href$="#seu-perfil"]').forEach(function (link) {
    link.setAttribute('href', window.location.pathname + window.location.search + '#seu-perfil');
  });
  let heard = false;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;
  if (reduce || saveData) {
    video.autoplay = false;
    video.pause();
    status.textContent = 'Toque para assistir e ouvir a orientação.';
  }
  button.addEventListener('click', async function () {
    if (!heard || video.ended || !video.paused) video.currentTime = 0;
    video.loop = false;
    video.muted = false;
    button.disabled = true;
    try {
      await video.play();
      heard = true;
      button.textContent = 'Recomeçar com som';
      status.textContent = 'Assista à orientação e preencha seu perfil abaixo.';
    } catch (_) {
      status.textContent = 'Use os controles do vídeo para assistir, ou leia a orientação abaixo.';
    } finally { button.disabled = false; }
  });
  video.addEventListener('pause', function () {
    if (heard && !video.ended) button.textContent = 'Continuar com som';
  });
  video.addEventListener('ended', function () {
    button.textContent = 'Ouvir novamente';
    status.textContent = 'Seu próximo passo: preencher o perfil para a equipe orientar seu atendimento.';
  });
  video.addEventListener('error', function () {
    button.disabled = true;
    status.textContent = 'O vídeo está indisponível. Leia a orientação e preencha seu perfil.';
  });
  video.addEventListener('volumechange', function () {
    if (!video.muted && !heard) {heard = true;video.loop = false;}
  });
})();
