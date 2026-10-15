# OpenAI Login Helper

A Manifest V3 extension for Brave and Chromium that fills OpenAI login forms using accounts you save locally. Built with React, TypeScript, Vite, and dnd-kit.

- Open the account picker on supported OpenAI login pages.
- Select an account and click **Start** to fill email, password, and a one-time code, then click Continue at each step.
- Add, edit, delete, search, and drag to reorder accounts.
- Manage accounts from the toolbar popup or the dedicated account manager.

## Development

Requires Node.js 20.19 or later.

```sh
git clone https://github.com/neikop/openai-login-helper.git
cd openai-login-helper
npm ci
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Build once, then watch source files and update `dist/` |
| `npm run typecheck` | Check UI TypeScript |
| `npm run check` | Check TypeScript and extension JavaScript syntax |
| `npm run build` | Validate and build the extension into `dist/` |
| `npm run pack` | Build and create `artifacts/openai-login-helper-2.0.0.zip` |

The development watcher writes extension files; it does not run a web server or HMR. After changes, reload the extension and refresh the login page. Run `npm install` when adding dependencies; use `npm ci` to install the lockfile on another machine.

## Install or update

1. Run `npm run build`.
2. Open `brave://extensions` or `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select the repository's `dist/` directory.
4. Pin the extension, open its popup, and add an account.
5. Visit `https://auth.openai.com/log-in`, select an account, and click **Start**.

For subsequent updates, reload the extension and refresh the login page. If using a packaged ZIP, extract it and load the `openai-login-helper` directory inside; npm is not required.

Start is available only when the active tab is on `https://auth.openai.com/log-in` or `https://auth.openai.com/log-in-or-create-account` and the extension detects the email form. Each run begins at the email step. The extension does not open a login tab automatically. If the embedded picker is unavailable, use the toolbar popup.

## Account entry

Email, password, and the MFA secret key are required; the account label is optional. Paste space-, tab-, or newline-separated credentials into the Email field to populate the fields. Press Space or Enter in Email or Password to move to the next field, then save the account.

The MFA field accepts a Base32 TOTP secret or an `otpauth://totp` URL, not a six-digit code. The current interface uses Vietnamese labels and displays **Thinking…** during login.

## Storage and login behavior

- Accounts are stored in `chrome.storage.local` in your browser profile, without cloud sync. Passwords and MFA secrets are not encrypted with a separate vault password. Delete an account in the UI or uninstall the extension to remove its stored copy.
- Content scripts cannot read the account store directly. The embedded picker uses the extension's origin. Only the required email, password, or generated code is sent to the form after you click Start; the MFA secret is never inserted into the page.
- One run operates at a time, on the selected tab. Temporary session data is cleared when you stop, close the tab, leave the authentication domain, encounter an error, or reach the five-minute timeout. Saved accounts remain available.
- Editing or deleting the active account stops its run. Each step is submitted at most once; stopping does not undo an already submitted request.
- CAPTCHA, email/SMS codes, passkeys, and social login require manual interaction. TOTP generation is local and requires an accurate system clock.
- The flow is Email → Password → One-time code, clicking only Continue. After the final Continue click, the run ends and temporary data is cleared immediately. The popup keeps **Thinking…** visible for three seconds before closing. The extension does not wait for a success response or interact with subsequent account-selection or consent screens. Finishing autofill does not confirm a successful login.
- Notices replace previous notices and expire after three seconds.

## Project layout

- `src/ui/`: shared React UI for the popup, embedded picker, and account manager.
- `src/extension/`: service worker, account storage, form detection, and TOTP generation.
- `src/shared/`: shared timing configuration.
- `public/manifest.json`: extension permissions and configuration.
- `scripts/`: extension build, watch, and ZIP packaging.

## Verification

TypeScript, syntax checks, and production builds pass. An earlier version was tested on Brave through email, password, and MFA to the Codex consent screen. The latest UI, drag-and-drop, and delayed-close changes have not been retested in a live browser. See [VERIFICATION.md](VERIFICATION.md) for details. OpenAI page changes may require selector updates.

Independent project, not affiliated with OpenAI.
