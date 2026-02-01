/**
 * Theme & PWA Manager
 * Handles: Light/Dark Mode Toggle + PWA Install Prompt
 */

const ThemePWA = {
    // --- THEME LOGIC ---
    initTheme: function () {
        const savedTheme = localStorage.getItem('app-theme') || 'dark'; // Default to dark
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateToggleIcon(savedTheme);
    },

    toggleTheme: function () {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('app-theme', next);
        this.updateToggleIcon(next);

        // Dispatch event for charts or other listeners
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: next } }));
    },

    updateToggleIcon: function (theme) {
        const btn = document.getElementById('btnThemeToggle');
        if (!btn) return;

        const icon = btn.querySelector('i');
        if (theme === 'light') {
            icon.className = 'bi bi-moon-stars-fill'; // Show Moon to switch to Dark
            btn.title = "Cambiar a Modo Oscuro";
        } else {
            icon.className = 'bi bi-brightness-high-fill'; // Show Sun to switch to Light
            btn.title = "Cambiar a Modo Claro";
        }
    },

    // --- PWA INSTALL LOGIC ---
    deferredPrompt: null,

    initPWA: function () {
        const installBtn = document.getElementById('btnInstallApp') || document.getElementById('installButton');
        const installContainer = document.getElementById('installContainer'); // Container for mobile layout

        if (!installBtn) return;

        // Hide initially
        if (installContainer) installContainer.style.display = 'none';
        else installBtn.style.display = 'none';

        window.addEventListener('beforeinstallprompt', (e) => {
            // Prevent Chrome 67 and earlier from automatically showing the prompt
            e.preventDefault();
            // Stash the event so it can be triggered later.
            this.deferredPrompt = e;

            // Show the install button
            if (installContainer) installContainer.style.display = 'block';
            else installBtn.style.display = 'flex';

            console.log("PWA Install Prompt captured");
        });

        installBtn.addEventListener('click', async () => {
            if (!this.deferredPrompt) return;

            // Show the install prompt
            this.deferredPrompt.prompt();

            // Wait for the user to respond to the prompt
            const { outcome } = await this.deferredPrompt.userChoice;
            console.log(`User response to the install prompt: ${outcome}`);

            // We've used the prompt, and can't use it again, throw it away
            this.deferredPrompt = null;

            // Hide button immediately after choice
            if (installContainer) installContainer.style.display = 'none';
            else installBtn.style.display = 'none';
        });

        window.addEventListener('appinstalled', () => {
            // Hide the app-provided install promotion
            if (installContainer) installContainer.style.display = 'none';
            else installBtn.style.display = 'none';
            this.deferredPrompt = null;
            console.log('PWA was installed');
        });
    }
};

// Initialize on Load
document.addEventListener('DOMContentLoaded', () => {
    ThemePWA.initTheme();
    ThemePWA.initPWA();

    // Attach toggle listener if button exists
    const toggleBtn = document.getElementById('btnThemeToggle');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => ThemePWA.toggleTheme());
    }
});
