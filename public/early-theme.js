(function () {
  try {
    var mode = localStorage.getItem('learnx_theme_mode');
    if (mode === 'dark' || (!mode && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    }
  } catch (error) {
    // Theme preference is optional; rendering must continue if storage is unavailable.
  }
})();
