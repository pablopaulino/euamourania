export function mount(container) {
  const panel = document.createElement("section");
  panel.className = "admin-panel";
  const heading = document.createElement("h2");
  heading.textContent = "Automação editorial";
  const message = document.createElement("p");
  message.textContent = "A execução automática de pautas ainda não está disponível neste ambiente.";
  panel.append(heading, message);
  container.replaceChildren(panel);
}

export function unmount(container) {
  container?.replaceChildren();
}
