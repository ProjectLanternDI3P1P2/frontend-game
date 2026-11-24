<#--
  Applied while the external theme stylesheet is still downloading. Keep this
  intentionally small: it prevents an unstyled flash without duplicating the
  complete Lantern theme.
-->
<style>
  html, body { margin: 0; min-height: 100%; background: #0b0b10; color: #f4efe4; font-family: "Segoe UI", system-ui, sans-serif; }
  .auth { position: relative; display: flex; align-items: center; justify-content: center; gap: 4rem; min-height: 100dvh; overflow: hidden; background: #0b0b10; }
  .auth::before { position: absolute; z-index: 1; inset: 0; background: linear-gradient(90deg, rgb(11 11 16 / 82%), rgb(11 11 16 / 64%)), linear-gradient(180deg, rgb(11 11 16 / 34%), rgb(11 11 16 / 76%)); content: ""; }
  .auth__dungeon-background { position: absolute; z-index: 0; inset: 0; width: 100%; height: 100%; object-fit: cover; opacity: .72; }
  .auth__side, .auth > .login-pf-page { position: relative; z-index: 2; }
  .login-pf-page .card-pf { width: min(33.333vw, 40rem); max-width: 40rem; padding: 2rem; border: 1px solid #594735; border-radius: 6px; background: #28221d; box-shadow: 0 0 0 1px rgb(224 180 87 / 20%), 0 8px 20px rgb(0 0 0 / 38%); }
</style>
