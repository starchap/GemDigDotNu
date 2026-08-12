import type { LobbySnapshot } from "../../domains/lobby/Lobby";

export interface LobbyScreenProps {
  snapshot: LobbySnapshot;
  isHost: boolean;
  onSetMaxPlayers?: (maxPlayers: number) => void;
  onSetMapImage?: (dataUrl: string) => void;
  onStart?: () => void;
}

export function renderLobbyScreen(root: HTMLElement, props: LobbyScreenProps): void {
  const { snapshot, isHost, onSetMaxPlayers, onSetMapImage, onStart } = props;
  root.innerHTML = "";

  const heading = document.createElement("h1");
  heading.textContent = "Lobby";
  root.appendChild(heading);

  const inviteLabel = document.createElement("p");
  inviteLabel.className = "hint";
  inviteLabel.textContent = "Invite ID — share this with friends";
  root.appendChild(inviteLabel);

  const inviteId = document.createElement("div");
  inviteId.className = "invite-id";
  inviteId.textContent = snapshot.inviteId;
  root.appendChild(inviteId);

  const shareRow = document.createElement("div");
  shareRow.className = "share-row";

  const shareLinkInput = document.createElement("input");
  shareLinkInput.type = "text";
  shareLinkInput.className = "share-link-input";
  shareLinkInput.readOnly = true;
  shareLinkInput.value = `${window.location.origin}${window.location.pathname}?lobby=${snapshot.inviteId}`;

  const copyLinkButton = document.createElement("button");
  copyLinkButton.type = "button";
  copyLinkButton.className = "secondary";
  copyLinkButton.textContent = "Copy link";
  copyLinkButton.addEventListener("click", () => {
    navigator.clipboard.writeText(shareLinkInput.value).then(() => {
      copyLinkButton.textContent = "Copied!";
      window.setTimeout(() => {
        copyLinkButton.textContent = "Copy link";
      }, 1500);
    });
  });

  shareRow.append(shareLinkInput, copyLinkButton);
  root.appendChild(shareRow);

  const playerList = document.createElement("ul");
  playerList.className = "player-list";
  for (const player of snapshot.players) {
    const item = document.createElement("li");
    const nameSpan = document.createElement("span");
    nameSpan.textContent = player.name;
    item.appendChild(nameSpan);
    if (player.id === snapshot.hostId) {
      const badge = document.createElement("span");
      badge.className = "host-badge";
      badge.textContent = "HOST";
      item.appendChild(badge);
    }
    playerList.appendChild(item);
  }
  root.appendChild(playerList);

  const countLabel = document.createElement("p");
  countLabel.className = "hint";
  countLabel.textContent = `${snapshot.players.length} / ${snapshot.maxPlayers} players`;
  root.appendChild(countLabel);

  if (isHost && onSetMaxPlayers && onStart) {
    const field = document.createElement("div");
    field.className = "field";

    const label = document.createElement("label");
    label.textContent = "Max players (up to 16)";
    label.htmlFor = "lobby-max-players";

    const input = document.createElement("input");
    input.id = "lobby-max-players";
    input.type = "number";
    input.min = String(snapshot.players.length);
    input.max = "16";
    input.value = String(snapshot.maxPlayers);
    input.addEventListener("change", () => {
      onSetMaxPlayers(Number(input.value));
    });

    field.append(label, input);
    root.appendChild(field);

    const mapField = document.createElement("div");
    mapField.className = "field";

    const mapLabel = document.createElement("label");
    mapLabel.textContent = "Map image";
    mapLabel.htmlFor = "lobby-map-image";

    const mapInput = document.createElement("input");
    mapInput.id = "lobby-map-image";
    mapInput.type = "file";
    mapInput.accept = "image/*";
    mapInput.addEventListener("change", () => {
      const file = mapInput.files?.[0];
      if (!file || !onSetMapImage) return;
      const reader = new FileReader();
      reader.onload = () => onSetMapImage(reader.result as string);
      reader.readAsDataURL(file);
    });

    mapField.append(mapLabel, mapInput);
    root.appendChild(mapField);

    if (snapshot.mapImageDataUrl) {
      const preview = document.createElement("img");
      preview.className = "map-preview";
      preview.src = snapshot.mapImageDataUrl;
      root.appendChild(preview);
    }

    const startButton = document.createElement("button");
    startButton.textContent = "START";
    startButton.disabled = !snapshot.mapImageDataUrl;
    startButton.addEventListener("click", onStart);
    root.appendChild(startButton);
  } else {
    const waitingNotice = document.createElement("p");
    waitingNotice.className = "hint";
    waitingNotice.textContent = "Waiting for the host to start the round…";
    root.appendChild(waitingNotice);
  }
}
