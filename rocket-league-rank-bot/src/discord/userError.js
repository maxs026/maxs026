/** Erreur prévisible dont le message est destiné à l'utilisateur (pas une panne du bot). */
export class UserFacingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UserFacingError';
  }
}
