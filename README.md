# MC Server Helper — Minecraft Server Studio

MC Server Helper is a cross-platform Electron desktop app for downloading official Minecraft server files, keeping each server in its own local workspace, and operating the server through an embedded console.

## Run it locally

1. Install Node.js 18 or newer.
2. Install a Java runtime compatible with the Minecraft version you want to run. Minecraft 1.20.5+ generally needs Java 21; older versions may use Java 17.
3. From this folder, install dependencies:

   ```sh
   npm install
   ```

4. Start the app:

   ```sh
   npm start
   ```

## Build a Windows installer

On Windows, install Node.js 20 or newer, open a terminal in the project folder, and run:

```powershell
npm install
npm run dist:win
```

The installer will be created in `release/` as `MC Server Helper Setup <version>.exe`. It creates normal Start Menu and Desktop shortcuts. Java is still installed separately because Minecraft servers require it.

To publish an installer automatically through GitHub Actions, push a version tag:

```sh
git tag v0.1.0
git push origin v0.1.0
```

The `Windows release` workflow builds the installer on a Windows runner, attaches it to the GitHub Release, and also saves it as a workflow artifact. You can run the workflow manually from the Actions tab as well, but only version tags create a published release.

The app downloads release metadata from Mojang's `version_manifest_v2.json`. A new server is stored beneath Electron's per-user app data directory in a `servers/<server-name>` folder. Each folder contains `server.jar`, `server.json`, and both `start-server.sh` and `start-server.bat`.

The first time you choose **Initialize server**, the app shows the official Minecraft EULA link. After you review it, choose **Accept and continue** and MC Server Helper writes `eula=true` for that server. The action then changes to **Start server**.

RAM can be changed from a server card's **Settings** action or from the server console. The setting updates the generated launch scripts and applies the next time the server starts.

Each server also has an **Online** toggle. Offline starts only Minecraft. Online starts the playit agent first, provided the agent has been installed and claimed in the Networking tab; the playit tunnel itself must already be configured for that server's local port.

For online play, the Networking tab can download and run the official playit agent in the background. On first setup, start the agent, open the claim link printed in the agent log, sign in or create a playit.gg account, claim the agent, and create a Minecraft Java tunnel pointing at the server's local port. Port forwarding and a virtual LAN such as Hamachi remain alternatives. The Help tab explains memory allocation, server files, local/LAN/online play, and playit.

## Development checks

```sh
npm run check
```

This checks all JavaScript entry points for syntax errors.

## Creating the feature commits

This managed workspace permits project-file edits but does not permit writes inside `.git`, so commits could not be created here. In a normal writable checkout, create the requested feature commits with:

```sh
git add package.json .gitignore src/main.js src/preload.js
git commit -m "Build Electron server management foundation"

git add src/index.html src/styles.css src/renderer.js README.md
git commit -m "Add server workspace and live console UI"
```
