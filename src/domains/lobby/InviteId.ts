const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid misreads
const LENGTH = 5;

export function generateInviteId(): string {
  let id = "";
  for (let position = 0; position < LENGTH; position++) {
    id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return id;
}
