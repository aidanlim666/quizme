# QuizMe shortcuts

QuizMe needs two shortcuts and one automation on the iPhone. Build the shortcuts once on your own phone, then share them by iCloud link. Each user has to create the automation themselves, because Apple doesn't allow automations to be shared.

The user-facing version of these steps lives in `web/setup.html`. Keep the two in sync.

```
Instagram opened
   └─▶ Automation (Run Immediately) ─▶ "QuizMe Gate"
          ├─ quizme_unlock.txt modified < 30 s ago? ─▶ stop (Instagram stays open)
          └─ otherwise ─▶ open https://<site>/?s=<timestamp>   (Safari, quiz)
                              └─ correct answer ─▶ shortcuts://run-shortcut?name=QuizMe%20Unlock
                                                     └─▶ "QuizMe Unlock": write quizme_unlock.txt, open Instagram
                                                            └─▶ automation fires again → Gate sees fresh file → stop
```

## 1. QuizMe Gate

| # | Action | Settings |
|---|--------|----------|
| 1 | **Get File** | Folder: *Shortcuts*. Path: `quizme_unlock.txt`. **Error If Not Found: off**. Show Document Picker: off. |
| 2 | **If** | *File* **has any value** |
| 3 | **Get Details of Files** | Detail: **Last Modified Date**, of *File* |
| 4 | **Get Time Between Dates** | Get time between *Last Modified Date* and *Current Date* in **Seconds** |
| 5 | **If** | *Time Between Dates* **is less than** `30` |
| 6 | **Stop This Shortcut** | (inside the inner If) |
| 7 | End If / End If | (close both) |
| 8 | **Format Date** | *Current Date*. Date Format: **Custom**, `yyyyMMddHHmmss` |
| 9 | **URL** | `https://<your-site>/?s=` then insert the *Formatted Date* variable |
| 10 | **Open URLs** | *URL* |

Notes:
- **Pass window (30 s):** this only has to cover the moment between the Unlock shortcut opening Instagram and the automation re-firing. Keep it short so that leaving Instagram and coming back costs another question.
- **`?s=` session id:** reloading the quiz page during the same visit keeps a solved question solved, while a new visit always gets a new question. Without `?s=`, the page falls back to a 30-second grace period (`solvedGraceMs` in `web/src/config.js`).
- **Check the sign of step 4** after building: temporarily add **Show Result** after it, run Unlock, then run Gate by hand. It should show a small **positive** number. If it's negative, swap the two dates. If you skip this, the `< 30` check is always true and the quiz never appears.

## 2. QuizMe Unlock

The name must be exactly `QuizMe Unlock`. The web page calls it by name (`unlockShortcutName` in `web/src/config.js`).

| # | Action | Settings |
|---|--------|----------|
| 1 | **Text** | `unlocked` |
| 2 | **Save File** | Save *Text* to the *Shortcuts* folder. **Ask Where to Save: off**. Subpath: `quizme_unlock.txt`. **Overwrite If File Exists: on**. |
| 3 | **Open App** | *Instagram* |

## 3. Automation (each user does this by hand)

Shortcuts → **Automation** → **+** → **App** → choose **Instagram** → **Is Opened** checked, **Is Closed** unchecked → **Run Immediately** → **Notify When Run** off → Next → pick **QuizMe Gate**. If it isn't offered: New Blank Automation → **Run Shortcut** → QuizMe Gate.

## Publishing the iCloud links

1. In Shortcuts, long-press each shortcut → **Share** → **Copy iCloud Link**.
2. Paste the links into `CONFIG.shortcutLinks.gate` / `.unlock` in `web/src/config.js` and redeploy. The setup page then shows "Get" buttons instead of the manual steps.
3. **Before sharing Gate, set its URL action to the deployed site.** Recipients get the URL you built in.

## Device test checklist

Run on a real iPhone, ideally on both the current iOS and one version back:

- [ ] Cold-open Instagram: lands on a question in Safari.
- [ ] Wrong answer twice: the answer and explanation are revealed, and you still must enter or tap the correct answer.
- [ ] Correct answer, then **Continue to Instagram**, then **Open**: Instagram opens with **no loop back** to the quiz.
- [ ] Wait more than 30 s, then switch back to Instagram from the app switcher: you get a new question.
- [ ] Refresh the quiz page mid-question: same question, wrong-attempt count kept.
- [ ] First run ever (delete `quizme_unlock.txt` in Files → iCloud Drive → Shortcuts): quiz shown, no error.
- [ ] Airplane mode: note the behavior. Expect the "Couldn't load questions" screen with Retry.
- [ ] First-run permission prompts: "Always Allow" sticks, and they don't come back on later opens.
