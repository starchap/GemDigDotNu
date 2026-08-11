export interface CreateLobbyScreenCallbacks {
  onCreate: (maxPlayers: number) => void;
  onBack: () => void;
}

const DEFAULT_MAX_PLAYERS = 8;

export function renderCreateLobbyScreen(root: HTMLElement, callbacks: CreateLobbyScreenCallbacks): void {
  root.innerHTML = "";

  const heading = document.createElement("h1");
  heading.textContent = "Create a lobby";
  root.appendChild(heading);

  const form = document.createElement("form");

  const field = document.createElement("div");
  field.className = "field";

  const label = document.createElement("label");
  label.textContent = "Max players (up to 16)";
  label.htmlFor = "max-players";

  const input = document.createElement("input");
  input.id = "max-players";
  input.type = "number";
  input.min = "2";
  input.max = "16";
  input.value = String(DEFAULT_MAX_PLAYERS);
  input.required = true;

  field.append(label, input);

  const buttonRow = document.createElement("div");
  buttonRow.className = "button-row";

  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "secondary";
  backButton.textContent = "Back";
  backButton.addEventListener("click", callbacks.onBack);

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.textContent = "Create";

  buttonRow.append(backButton, submitButton);
  form.append(field, buttonRow);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const maxPlayers = Math.max(2, Math.min(16, Number(input.value)));
    callbacks.onCreate(maxPlayers);
  });

  root.appendChild(form);
}
