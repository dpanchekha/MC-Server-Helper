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

The app downloads release metadata from Mojang's `version_manifest_v2.json`. A new server is stored beneath Electron's per-user app data directory in a `servers/<server-name>` folder. Each folder contains `server.jar`, `server.json`, and both `start-server.sh` and `start-server.bat`.

The first time you choose **Initialize server**, the app shows the official Minecraft EULA link. After you review it, choose **Accept and continue** and MC Server Helper writes `eula=true` for that server. The action then changes to **Start server**.

RAM can be changed from a server card's **Settings** action or from the server console. The setting updates the generated launch scripts and applies the next time the server starts.

For online play, the current app only hosts the server locally. Friends need a reachable connection through port forwarding, a virtual LAN such as Hamachi, or a tunnel service such as playit.gg. A future online-play feature could manage a tunnel process inside the app, with playit.gg being the simplest first integration; it would require account/authentication and careful handling of the tunnel client.

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
