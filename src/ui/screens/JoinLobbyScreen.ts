export interface JoinLobbyScreenCallbacks {
  onJoin: (inviteId: string) => void;
  onBack: () => void;
  error?: string;
}

export function renderJoinLobbyScreen(root: HTMLElement, callbacks: JoinLobbyScreenCallbacks): void {
  root.innerHTML = "";

  const heading = document.createElement("h1");
  heading.textContent = "Join a lobby";
  root.appendChild(heading);

  const form = document.createElement("form");

  const field = document.createElement("div");
  field.className = "field";

  const label = document.createElement("label");
  label.textContent = "Invite ID";
  label.htmlFor = "invite-id";

  const input = document.createElement("input");
  input.id = "invite-id";
  input.type = "text";
  input.maxLength = 5;
  input.required = true;
  input.autofocus = true;
  input.style.textTransform = "uppercase";

  field.append(label, input);

  if (callbacks.error) {
    const errorText = document.createElement("p");
    errorText.className = "error";
    errorText.textContent = callbacks.error;
    field.appendChild(errorText);
  }

  const buttonRow = document.createElement("div");
  buttonRow.className = "button-row";

  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "secondary";
  backButton.textContent = "Back";
  backButton.addEventListener("click", callbacks.onBack);

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.textContent = "Join";

  buttonRow.append(backButton, submitButton);
  form.append(field, buttonRow);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const inviteId = input.value.trim().toUpperCase();
    if (inviteId.length > 0) {
      callbacks.onJoin(inviteId);
    }
  });

  root.appendChild(form);
}
