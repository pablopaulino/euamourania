const footer = document.querySelector(".site-footer");

if (footer && !document.querySelector(".volunteer-invite") && !location.pathname.includes("/colabore")) {
  footer.insertAdjacentHTML("beforebegin", `
    <section class="volunteer-invite" aria-labelledby="volunteer-invite-title">
      <div class="container volunteer-invite-box">
        <div>
          <p class="eyebrow">Colaboração voluntária</p>
          <h2 id="volunteer-invite-title">Quer ajudar a contar histórias de Urânia?</h2>
          <p>Cadastre-se para sugerir pautas, enviar informações, fotos ou colaborar voluntariamente com conteúdos do Eu Amo Urânia.</p>
        </div>
        <a class="button button-primary" href="/colabore/">Quero colaborar</a>
      </div>
    </section>
  `);

  if (!document.getElementById("volunteer-invite-style")) {
    const style = document.createElement("style");
    style.id = "volunteer-invite-style";
    style.textContent = `
      .volunteer-invite{padding:clamp(1.5rem,4vw,2.7rem) 0;background:#f6fbfc}
      .volunteer-invite-box{display:flex;align-items:center;justify-content:space-between;gap:1.2rem;padding:clamp(1rem,3vw,1.45rem);border:1px solid rgba(220,232,236,.95);border-radius:26px;background:#fff;box-shadow:0 16px 42px rgba(7,59,76,.07)}
      .volunteer-invite h2{margin:.15rem 0 .35rem;color:var(--navy);font-size:clamp(1.35rem,3vw,2rem);line-height:1.08;letter-spacing:-.045em}
      .volunteer-invite p:not(.eyebrow){max-width:720px;margin:0;color:#536b75;line-height:1.55}
      .volunteer-invite .button{flex:0 0 auto;border:0;text-decoration:none}
      @media(max-width:720px){.volunteer-invite-box{display:grid}.volunteer-invite .button{width:100%;justify-content:center}}
    `;
    document.head.append(style);
  }
}
