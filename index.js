const remoteMain = require('@electron/remote/main')
remoteMain.initialize()

// Requirements
const { app, BrowserWindow, ipcMain, Menu, shell } = require('electron')
const axios                           = require('axios')
const ejse                            = require('ejs-electron')
const fs                              = require('fs')
const isDev                           = require('./app/assets/js/isdev')
const path                            = require('path')
const semver                          = require('semver')
const { pathToFileURL }                 = require('url')
const { AZURE_CLIENT_ID, MSFT_OPCODE, MSFT_REPLY_TYPE, MSFT_ERROR, SHELL_OPCODE } = require('./app/assets/js/ipcconstants')
const LangLoader                      = require('./app/assets/js/langloader')
const { exec }                        = require('child_process')
const os                              = require('os')

// Setup Lang
LangLoader.setupLanguage()

// Setup custom updater that checks GitHub releases
function initAutoUpdater(event, data) {
    
    // Send ready status
    event.sender.send('autoUpdateNotification', 'ready')
}

// Check for updates by comparing with master branch package.json
async function checkForUpdates() {
    try {
        // Configure axios to ignore SSL errors in development
        const axiosConfig = isDev ? {
            httpsAgent: new (require('https').Agent)({
                rejectUnauthorized: false
            })
        } : {}
        
        // Get package.json from master branch
        const response = await axios.get('https://raw.githubusercontent.com/Eminium-Games/EminiumLauncher-v2/master/package.json', axiosConfig)
        const masterPackage = response.data
        
        const currentVersion = app.getVersion()
        const masterVersion = masterPackage.version
        
        console.log(`Current version: ${currentVersion}, Master version: ${masterVersion}`)
        
        // Compare versions
        if (semver.gt(masterVersion, currentVersion)) {
            console.log('Update available!')
            
            // Download directly from GitHub repo (latest build)
            const downloadUrl = `https://github.com/Eminium-Games/EminiumLauncher-v2/releases/download/v${masterVersion}/Eminium%20Games%20Launcher%20Setup%20${masterVersion}.exe`
            
            return {
                updateAvailable: true,
                currentVersion,
                latestVersion: masterVersion,
                downloadUrl,
                canInstall: true
            }
        } else {
            console.log('No update available')
            return {
                updateAvailable: false,
                currentVersion,
                latestVersion: masterVersion
            }
        }
    } catch (error) {
        console.error('Error checking for updates:', error.message)
        // Don't throw error, just return no update available
        return {
            updateAvailable: false,
            currentVersion: app.getVersion(),
            latestVersion: app.getVersion(),
            error: error.message
        }
    }
}

// Download and install update automatically
async function downloadAndInstallUpdate(latestVersion) {
    try {
        const downloadUrl = `https://github.com/Eminium-Games/EminiumLauncher-v2/releases/download/v${latestVersion}/Eminium.Games.Launcher.Setup.${latestVersion}.exe`
        const tempDir = os.tmpdir()
        const installerPath = path.join(tempDir, `EminiumLauncher-${latestVersion}.exe`)
        
        console.log(`Downloading update from: ${downloadUrl}`)
        console.log(`Saving to: ${installerPath}`)
        
        // Download the installer
        const response = await axios({
            method: 'GET',
            url: downloadUrl,
            responseType: 'stream'
        })
        
        const writer = fs.createWriteStream(installerPath)
        response.data.pipe(writer)
        
        await new Promise((resolve, reject) => {
            writer.on('finish', resolve)
            writer.on('error', reject)
        })
        
        console.log('Download complete, installing...')
        
        // Execute the installer and quit the app
        exec(`"${installerPath}" /S`, (error) => {
            if (error) {
                console.error('Installation error:', error)
                return
            }
            console.log('Installer launched, quitting app...')
            app.quit()
        })
        
    } catch (error) {
        console.error('Error downloading update:', error)
        throw error
    }
}

// Open channel to listen for update actions.
ipcMain.on('autoUpdateAction', async (event, arg, data) => {
    switch(arg){
        case 'initAutoUpdater':
            console.log('Initializing auto updater.')
            initAutoUpdater(event, data)
            event.sender.send('autoUpdateNotification', 'ready')
            break
        case 'checkForUpdate':
            console.log('Checking for updates...')
            event.sender.send('autoUpdateNotification', 'checking-for-update')
            try {
                const updateInfo = await checkForUpdates()
                if (updateInfo.updateAvailable) {
                    event.sender.send('autoUpdateNotification', 'update-available', updateInfo)
                } else {
                    event.sender.send('autoUpdateNotification', 'update-not-available', updateInfo)
                }
            } catch (err) {
                event.sender.send('autoUpdateNotification', 'realerror', err)
            }
            break
        case 'allowPrereleaseChange':
            // Not needed for custom updater
            break
        case 'installUpdateNow':
            console.log('Starting update installation...')
            try {
                const updateInfo = await checkForUpdates()
                if (updateInfo.updateAvailable && updateInfo.canInstall) {
                    console.log('Release file exists, downloading and installing...')
                    event.sender.send('autoUpdateNotification', 'update-downloaded', updateInfo)
                    await downloadAndInstallUpdate(updateInfo.latestVersion)
                } else if (updateInfo.updateAvailable && !updateInfo.canInstall) {
                    console.log('Release not ready, opening releases page...')
                    shell.openExternal('https://github.com/Eminium-Games/EminiumLauncher-v2/releases/latest')
                } else {
                    console.log('No update available to install')
                }
            } catch (error) {
                console.error('Error during update installation:', error)
                event.sender.send('autoUpdateNotification', 'realerror', error)
            }
            break
        default:
            console.log('Unknown argument', arg)
    }
})

// Redirect distribution index event from preloader to renderer.
ipcMain.on('distributionIndexDone', (event, res) => {
    event.sender.send('distributionIndexDone', res)
})

// Handle trash item.
ipcMain.handle(SHELL_OPCODE.TRASH_ITEM, async (event, ...args) => {
    try {
        await shell.trashItem(args[0])
        return {
            result: true
        }
    } catch(error) {
        return {
            result: false,
            error: error
        }
    }
})

// Disable hardware acceleration.
// https://electronjs.org/docs/tutorial/offscreen-rendering
app.disableHardwareAcceleration()


const REDIRECT_URI_PREFIX = 'https://login.microsoftonline.com/common/oauth2/nativeclient?'

// Microsoft Auth Login
let msftAuthWindow
let msftAuthSuccess
let msftAuthViewSuccess
let msftAuthViewOnClose
ipcMain.on(MSFT_OPCODE.OPEN_LOGIN, (ipcEvent, ...arguments_) => {
    if (msftAuthWindow) {
        ipcEvent.reply(MSFT_OPCODE.REPLY_LOGIN, MSFT_REPLY_TYPE.ERROR, MSFT_ERROR.ALREADY_OPEN, msftAuthViewOnClose)
        return
    }
    msftAuthSuccess = false
    msftAuthViewSuccess = arguments_[0]
    msftAuthViewOnClose = arguments_[1]
    msftAuthWindow = new BrowserWindow({
        title: LangLoader.queryJS('index.microsoftLoginTitle'),
        backgroundColor: '#222222',
        width: 520,
        height: 600,
        frame: true,
        icon: getPlatformIcon('SealCircle')
    })

    msftAuthWindow.on('closed', () => {
        msftAuthWindow = undefined
    })

    msftAuthWindow.on('close', () => {
        if(!msftAuthSuccess) {
            ipcEvent.reply(MSFT_OPCODE.REPLY_LOGIN, MSFT_REPLY_TYPE.ERROR, MSFT_ERROR.NOT_FINISHED, msftAuthViewOnClose)
        }
    })

    msftAuthWindow.webContents.on('did-navigate', (_, uri) => {
        if (uri.startsWith(REDIRECT_URI_PREFIX)) {
            let queryMap = {}
            
            new URL(uri).searchParams.forEach((v, k) => {
                queryMap[k] = v;
            });

            ipcEvent.reply(MSFT_OPCODE.REPLY_LOGIN, MSFT_REPLY_TYPE.SUCCESS, queryMap, msftAuthViewSuccess)

            msftAuthSuccess = true
            msftAuthWindow.close()
            msftAuthWindow = null
        }
    })

    msftAuthWindow.removeMenu()
    msftAuthWindow.loadURL(`https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize?prompt=select_account&client_id=${AZURE_CLIENT_ID}&response_type=code&scope=XboxLive.signin%20offline_access&redirect_uri=https://login.microsoftonline.com/common/oauth2/nativeclient`)
})

// Microsoft Auth Logout
let msftLogoutWindow
let msftLogoutSuccess
let msftLogoutSuccessSent
ipcMain.on(MSFT_OPCODE.OPEN_LOGOUT, (ipcEvent, uuid, isLastAccount) => {
    if (msftLogoutWindow) {
        ipcEvent.reply(MSFT_OPCODE.REPLY_LOGOUT, MSFT_REPLY_TYPE.ERROR, MSFT_ERROR.ALREADY_OPEN)
        return
    }

    msftLogoutSuccess = false
    msftLogoutSuccessSent = false
    msftLogoutWindow = new BrowserWindow({
        title: LangLoader.queryJS('index.microsoftLogoutTitle'),
        backgroundColor: '#222222',
        width: 520,
        height: 600,
        frame: true,
        icon: getPlatformIcon('SealCircle')
    })

    msftLogoutWindow.on('closed', () => {
        msftLogoutWindow = undefined
    })

    msftLogoutWindow.on('close', () => {
        if(!msftLogoutSuccess) {
            ipcEvent.reply(MSFT_OPCODE.REPLY_LOGOUT, MSFT_REPLY_TYPE.ERROR, MSFT_ERROR.NOT_FINISHED)
        } else if(!msftLogoutSuccessSent) {
            msftLogoutSuccessSent = true
            ipcEvent.reply(MSFT_OPCODE.REPLY_LOGOUT, MSFT_REPLY_TYPE.SUCCESS, uuid, isLastAccount)
        }
    })
    
    msftLogoutWindow.webContents.on('did-navigate', (_, uri) => {
        if(uri.startsWith('https://login.microsoftonline.com/common/oauth2/v2.0/logoutsession')) {
            msftLogoutSuccess = true
            setTimeout(() => {
                if(!msftLogoutSuccessSent) {
                    msftLogoutSuccessSent = true
                    ipcEvent.reply(MSFT_OPCODE.REPLY_LOGOUT, MSFT_REPLY_TYPE.SUCCESS, uuid, isLastAccount)
                }

                if(msftLogoutWindow) {
                    msftLogoutWindow.close()
                    msftLogoutWindow = null
                }
            }, 5000)
        }
    })
    
    msftLogoutWindow.removeMenu()
    msftLogoutWindow.loadURL('https://login.microsoftonline.com/common/oauth2/v2.0/logout')
})

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

function createWindow() {

    win = new BrowserWindow({
        width: 980,
        height: 552,
        icon: getPlatformIcon('SealCircle'),
        frame: false,
        webPreferences: {
            preload: path.join(__dirname, 'app', 'assets', 'js', 'preloader.js'),
            nodeIntegration: true,
            contextIsolation: false
        },
        backgroundColor: '#171614'
    })
    remoteMain.enable(win.webContents)

    const data = {
        bkid: Math.floor((Math.random() * fs.readdirSync(path.join(__dirname, 'app', 'assets', 'images', 'backgrounds')).length)),
        lang: (str, placeHolders) => LangLoader.queryEJS(str, placeHolders)
    }
    Object.entries(data).forEach(([key, val]) => ejse.data(key, val))

    win.loadURL(pathToFileURL(path.join(__dirname, 'app', 'app.ejs')).toString())

    /*win.once('ready-to-show', () => {
        win.show()
    })*/

    win.removeMenu()

    win.resizable = true

    win.on('closed', () => {
        win = null
    })
}

function createMenu() {
    
    if(process.platform === 'darwin') {

        // Extend default included application menu to continue support for quit keyboard shortcut
        let applicationSubMenu = {
            label: 'Application',
            submenu: [{
                label: 'About Application',
                selector: 'orderFrontStandardAboutPanel:'
            }, {
                type: 'separator'
            }, {
                label: 'Quit',
                accelerator: 'Command+Q',
                click: () => {
                    app.quit()
                }
            }]
        }

        // New edit menu adds support for text-editing keyboard shortcuts
        let editSubMenu = {
            label: 'Edit',
            submenu: [{
                label: 'Undo',
                accelerator: 'CmdOrCtrl+Z',
                selector: 'undo:'
            }, {
                label: 'Redo',
                accelerator: 'Shift+CmdOrCtrl+Z',
                selector: 'redo:'
            }, {
                type: 'separator'
            }, {
                label: 'Cut',
                accelerator: 'CmdOrCtrl+X',
                selector: 'cut:'
            }, {
                label: 'Copy',
                accelerator: 'CmdOrCtrl+C',
                selector: 'copy:'
            }, {
                label: 'Paste',
                accelerator: 'CmdOrCtrl+V',
                selector: 'paste:'
            }, {
                label: 'Select All',
                accelerator: 'CmdOrCtrl+A',
                selector: 'selectAll:'
            }]
        }

        // Bundle submenus into a single template and build a menu object with it
        let menuTemplate = [applicationSubMenu, editSubMenu]
        let menuObject = Menu.buildFromTemplate(menuTemplate)

        // Assign it to the application
        Menu.setApplicationMenu(menuObject)

    }

}

function getPlatformIcon(filename){
    let ext
    switch(process.platform) {
        case 'win32':
            ext = 'ico'
            break
        case 'darwin':
        case 'linux':
        default:
            ext = 'png'
            break
    }

    return path.join(__dirname, 'app', 'assets', 'images', `${filename}.${ext}`)
}

app.on('ready', createWindow)
app.on('ready', createMenu)

app.on('window-all-closed', () => {
    // On macOS it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
        app.quit()
    }
})

app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
        createWindow()
    }
})
