export interface NameEntryScreenCallbacks {
  onSubmit: (name: string) => void;
}

export function renderNameEntryScreen(root: HTMLElement, callbacks: NameEntryScreenCallbacks): void {
  root.innerHTML = "";

  const heading = document.createElement("h1");
  heading.textContent = "Camo Hide & Seek";
  root.appendChild(heading);

  const form = document.createElement("form");

  const field = document.createElement("div");
  field.className = "field";

  const label = document.createElement("label");
  label.textContent = "Your name";
  label.htmlFor = "player-name";

  const input = document.createElement("input");
  input.id = "player-name";
  input.type = "text";
  input.maxLength = 20;
  input.required = true;
  input.autofocus = true;

  field.append(label, input);

  const submitButton = document.createElement("button");
  submitButton.type = "submit";
  submitButton.textContent = "Continue";

  form.append(field, submitButton);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = input.value.trim();
    if (name.length > 0) {
      callbacks.onSubmit(name);
    }
  });

  root.appendChild(form);
}
