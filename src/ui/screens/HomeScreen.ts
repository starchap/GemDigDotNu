export interface HomeScreenCallbacks {
  onCreateLobby: () => void;
  onJoinLobby: () => void;
}

export function renderHomeScreen(root: HTMLElement, callbacks: HomeScreenCallbacks): void {
  root.innerHTML = "";

  const heading = document.createElement("h1");
  heading.textContent = "Ready to play?";
  root.appendChild(heading);

  const buttonRow = document.createElement("div");
  buttonRow.className = "button-row";

  const createButton = document.createElement("button");
  createButton.textContent = "Create lobby";
  createButton.addEventListener("click", callbacks.onCreateLobby);

  const joinButton = document.createElement("button");
  joinButton.className = "secondary";
  joinButton.textContent = "Join lobby";
  joinButton.addEventListener("click", callbacks.onJoinLobby);

  buttonRow.append(createButton, joinButton);
  root.appendChild(buttonRow);
}
