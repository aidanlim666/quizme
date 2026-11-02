export const CONFIG = {
  /** Must match the name of the unlock shortcut on the user's iPhone exactly. */
  unlockShortcutName: 'QuizMe Unlock',

  /** Wrong answers allowed before the answer is revealed. */
  maxWrongAttempts: 2,

  /** How many recent question ids to avoid repeating. */
  recentLimit: 40,

  /**
   * If the page is opened without a ?s= session id (e.g. by hand), a solved question
   * stays solved across reloads for this long, then a new question is picked.
   */
  solvedGraceMs: 30_000,

  /**
   * iCloud share links for the two shortcuts, shown on the setup page.
   * To create one: build the shortcut on an iPhone, then Share → Copy iCloud Link.
   * Leave a link empty to show the manual build steps instead.
   */
  shortcutLinks: {
    gate: '',
    unlock: '',
  },
};

export function unlockUrl() {
  return `shortcuts://run-shortcut?name=${encodeURIComponent(CONFIG.unlockShortcutName)}`;
}
