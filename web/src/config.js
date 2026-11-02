export const CONFIG = {
  /** Must match the name of the unlock shortcut on the user's iPhone exactly. */
  unlockShortcutName: 'QuizMe Unlock',

  /** Wrong answers allowed before the answer is revealed. */
  maxWrongAttempts: 2,

  /** How many recent question ids to avoid repeating. */
  recentLimit: 40,

  /**
   * How long a solved question stays on screen. Within this window a reload, or switching away
   * and back, keeps it solved. After it, the next visit gets a new question. Gate only shows the
   * quiz again 30 s after an unlock, so keep this below that.
   */
  solvedGraceMs: 20_000,

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
