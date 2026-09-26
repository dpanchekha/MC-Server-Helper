const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const fsp = fs.promises;
const { spawn } = require('child_process');

const MANIFEST_URL = 'https://launchermeta.mojang.com/mc/game/version_manifest_v2.json';
const EULA_URL = 'https://aka.ms/MinecraftEULA';
const serversRoot = () => path.join(app.getPath('userData'), 'servers');
const processes = new Map();

function safeName(value) {
  return value.trim().replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-').replace(/\.+$/g, '').slice(0, 64) || 'My Server';
}

async function readJson(file) {
  try { return JSON.parse(await fsp.readFile(file, 'utf8')); } catch { return null; }
}

async function eulaAccepted(dir) {
  try { return /^eula\s*=\s*true\s*$/im.test(await fsp.readFile(path.join(dir, 'eula.txt'), 'utf8')); } catch { return false; }
}

async function listServers() {
  const root = serversRoot(); await fsp.mkdir(root, { recursive: true });
  const entries = await fsp.readdir(root, { withFileTypes: true });
  return Promise.all(entries.filter(e => e.isDirectory()).map(async entry => {
    const dir = path.join(root, entry.name); const meta = await readJson(path.join(dir, 'server.json')) || {};
    return { ...meta, folder: entry.name, running: processes.has(entry.name), eulaAccepted: await eulaAccepted(dir), path: dir };
  }));
}

async function fetchManifest() {
  const response = await fetch(MANIFEST_URL); if (!response.ok) throw new Error(`Manifest request failed (${response.status})`);
  const data = await response.json();
  return data.versions.filter(v => v.type === 'release').slice(0, 40).map(v => ({ id: v.id, url: v.url, releaseTime: v.releaseTime }));
}

async function createServer({ name, version }) {
  const folder = safeName(name); const dir = path.join(serversRoot(), folder);
  if (fs.existsSync(dir)) throw new Error('A server with that name already exists.');
  await fsp.mkdir(dir, { recursive: true });
  try {
    const info = await (await fetch(version.url)).json();
    const jarUrl = info.downloads?.server?.url;
    if (!jarUrl) throw new Error(`Minecraft ${version.id} does not publish a server download.`);
    const jar = await (await fetch(jarUrl)).arrayBuffer();
    await fsp.writeFile(path.join(dir, 'server.jar'), Buffer.from(jar));
    await fsp.writeFile(path.join(dir, 'server.json'), JSON.stringify({ name: folder, version: version.id, createdAt: new Date().toISOString(), ram: 4 }, null, 2));
    await writeLauncher(dir, 4);
    return (await listServers()).find(server => server.folder === folder);
  } catch (error) { await fsp.rm(dir, { recursive: true, force: true }); throw error; }
}

async function writeLauncher(dir, ram) {
  const memory = Math.max(1, Number(ram) || 4);
  const sh = `#!/bin/sh\ncd "$(dirname "$0")"\nexec java -Xmx${memory}G -Xms${memory}G -jar server.jar nogui\n`;
  const bat = `@echo off\ncd /d "%~dp0"\njava -Xmx${memory}G -Xms${memory}G -jar server.jar nogui\n`;
  await fsp.writeFile(path.join(dir, 'start-server.sh'), sh, { mode: 0o755 });
  await fsp.writeFile(path.join(dir, 'start-server.bat'), bat);
}

function startServer(folder, ram, onEvent) {
  if (processes.has(folder)) throw new Error('This server is already running.');
  const dir = path.join(serversRoot(), folder); const memory = Math.max(1, Number(ram) || 4);
  const command = process.platform === 'win32' ? 'java' : 'java';
  const child = spawn(command, [`-Xmx${memory}G`, `-Xms${memory}G`, '-jar', 'server.jar', 'nogui'], { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  processes.set(folder, child); onEvent({ type: 'status', status: 'starting' });
  const emit = (data, stream) => onEvent({ type: 'log', stream, data: data.toString() });
  child.stdout.on('data', data => emit(data, 'stdout')); child.stderr.on('data', data => emit(data, 'stderr'));
  child.on('error', error => { onEvent({ type: 'error', message: error.message.includes('ENOENT') ? 'Java was not found. Install Java 21 (or the version required by your server) and try again.' : error.message }); processes.delete(folder); });
  child.on('close', code => { processes.delete(folder); onEvent({ type: 'status', status: 'stopped', code }); });
}

async function acceptEula(folder) {
  const dir = path.join(serversRoot(), folder);
  if (!fs.existsSync(dir)) throw new Error('Server folder not found.');
  await fsp.writeFile(path.join(dir, 'eula.txt'), `# Minecraft EULA accepted through MC Server Helper\n# ${EULA_URL}\neula=true\n`);
  return listServers();
}

function sendCommand(folder, command) { const child = processes.get(folder); if (!child) throw new Error('Server is not running.'); child.stdin.write(`${command}\n`); }
function stopServer(folder) { const child = processes.get(folder); if (child) child.stdin.write('stop\n'); }

function createWindow() {
  const win = new BrowserWindow({ width: 1260, height: 820, minWidth: 980, minHeight: 640, backgroundColor: '#0d1319', webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false } });
  Menu.setApplicationMenu(null);
  win.setMenuBarVisibility(false);
  win.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {
  ipcMain.handle('versions:list', fetchManifest);
  ipcMain.handle('servers:list', listServers);
  ipcMain.handle('server:create', (_, payload) => createServer(payload));
  ipcMain.handle('server:update', async (_, { folder, ram }) => { const file = path.join(serversRoot(), folder, 'server.json'); const meta = await readJson(file); await fsp.writeFile(file, JSON.stringify({ ...meta, ram }, null, 2)); await writeLauncher(path.join(serversRoot(), folder), ram); return listServers(); });
  ipcMain.handle('server:delete', async (_, folder) => { if (processes.has(folder)) throw new Error('Stop the server before deleting it.'); await fsp.rm(path.join(serversRoot(), folder), { recursive: true, force: true }); return listServers(); });
  ipcMain.handle('server:open-folder', (_, folder) => shell.openPath(path.join(serversRoot(), folder)));
  ipcMain.handle('server:start', async (event, payload) => { if (!(await eulaAccepted(path.join(serversRoot(), payload.folder)))) return { needsEula: true }; startServer(payload.folder, payload.ram, message => event.sender.send('server:event', { folder: payload.folder, ...message })); return { started: true }; });
  ipcMain.handle('server:accept-eula', (_, folder) => acceptEula(folder));
  ipcMain.handle('server:command', (_, payload) => sendCommand(payload.folder, payload.command));
  ipcMain.handle('server:stop', (_, folder) => stopServer(folder));
  ipcMain.handle('app:java', () => process.platform === 'win32' ? 'Windows' : process.platform === 'darwin' ? 'macOS' : 'Linux');
  ipcMain.handle('app:open-eula', () => shell.openExternal(EULA_URL));
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
