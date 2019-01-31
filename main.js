const client = require('discord-rich-presence')('457775893746810880')

var unixTimestamp = Math.round(new Date("2017-09-15 00:00:00.000").getTime() / 1000);

const { app, Menu, BrowserWindow, Tray } = require('electron')
const { ipcMain } = require('electron')

const queryString = require('querystring')
const Store = require('electron-store')
const store = new Store({ cwd: '$__dirname/tokens' })
const cron = require('node-cron')
var http = require('https')
const util = require('util')
let tray = null

function createWindow() {
    ipcMain.on('get-account-data', (event, arg) => {

        event.sender.send('profile-picture', store.get('profilePicture'))
        event.sender.send('nickname', store.get('onlineID'))
    })


    ipcMain.on('logout-function', (event, arg) => {

        store.delete('accountInfo')
        store.delete('responses')
        app.relaunch()
        app.exit()
    })

    ipcMain.on('switch-status', (event, arg) => {
        if (arg == 'checked') {
            updateRPC()
            console.log("enabling rpc")
        } else {
            stopRPC()
            console.log("stopping rpc")
        }
    })

    //login screen for remoteplay 
    console.log('login DEBUG: ' + store.get('accountInfo'))
    if (store.get('responses') != undefined) {
        win = new BrowserWindow({ width: 414, height: 750, webPreferences: { nodeIntegration: true } })
        startCron()
        win.loadFile('site/index.html')
    } else {
        win = new BrowserWindow({ width: 414, height: 750, webPreferences: { nodeIntegration: false } })
        win.loadURL('https://id.sonyentertainmentnetwork.com/signin/?service_entity=urn:service-entity:psn&response_type=code&client_id=ba495a24-818c-472b-b12d-ff231c1b5745&redirect_uri=https://remoteplay.dl.playstation.net/remoteplay/redirect&scope=psn:clientapp&request_locale=en_US&ui=pr&service_logo=ps&layout_type=popup&smcid=remoteplay&PlatformPrivacyWs1=exempt&error=login_required&error_code=4165&error_description=User+is+not+authenticated#/signin?entry=%2Fsignin')
        win.webContents.on('did-finish-load', function () {
            getCode(win.webContents.getURL())
        })
        win.webContents.on('uncaughtException', function (error) {
            console.log(error)
        })
    }

}

function getCode(data) {
    win.nodeIntegration = true
    if (!data.startsWith("https://remoteplay.dl.playstation.net/remoteplay/redirect")) {
        return
    }
    // catching the RemotePlay auth code.
    var d = data.split('&')
    var c = d[0].split('=')
    console.log("Code: " + c[1] + "\n")
    login(c[1])
}

function login(code) {
    // login to remoteplay to get the token to get profile info
    var data = queryString.stringify({
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': 'https://remoteplay.dl.playstation.net/remoteplay/redirect'
    })

    var options = {
        method: 'POST',
        port: 443,
        hostname: 'auth.api.sonyentertainmentnetwork.com',
        path: '/2.0/oauth/token',
        headers: {
            'Authorization': 'Basic YmE0OTVhMjQtODE4Yy00NzJiLWIxMmQtZmYyMzFjMWI1NzQ1Om12YWlaa1JzQXNJMUlCa1k=',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': data.length
        }
    }

    var req = http.request(options, function (res) {
        res.setEncoding('ascii')
        res.on('data', function (body) {
            store.set('responses', body)
            startCron()
        })
    })
    req.on('error', function (e) {
        console.log('problem with request: ' + e.message)
    })

    req.write(data)
    req.end()
    if (store.get('accountInfo') == undefined) {
        console.log('exiting')
    }
}

function startCron() {
    if (store.get('responses') != undefined) {
        cron.schedule('*/1 * * * *', () => {
            getPsnPresence()
        })
    } else {
        app.relaunch()
        app.exit()
    }
}

function getPsnPresence() {
    var tokendata = store.get('responses')
    // getting the actual profile data using the token -> check console for it :D
    var object = JSON.parse(tokendata)

    console.log("Access token: " + object['access_token'])
    console.log("Refresh token: " + object['refresh_token'] + "\n") // -> to get a new Access token without login, implement later 

    var options = {
        method: 'GET',
        port: 443,
        hostname: 'us-prof.np.community.playstation.net',
        path: '/userProfile/v1/users/me/profile2?fields=npId,onlineId,avatarUrls,plus,aboutMe,languagesUsed,trophySummary(@default,progress,earnedTrophies),isOfficiallyVerified,personalDetail(@default,profilePictureUrls),personalDetailSharing,personalDetailSharingRequestMessageFlag,primaryOnlineStatus,presences(@titleInfo,hasBroadcastData),friendRelation,requestMessageFlag,blocking,mutualFriendsCount,following,followerCount,friendsCount,followingUsersCount&avatarSizes=m,xl&profilePictureSizes=m,xl&languagesUsedLanguageSet=set3&psVitaTitleIcon=circled&titleIconSize=s',
        headers: {
            'Authorization': 'Bearer ' + object['access_token']
        }
    }

    var req = http.request(options, function (res) {
        var data = ""
        res.setEncoding("ascii")
        res.on('data', function (chunk) {
            data += chunk
        })
        res.on('end', function () {
            console.log('1DEBUG JSON: ' + data)
            //var d = JSON.parse(data)
            //console.log('DEBUG TYPEOF DATA: ' + typeof(data))
            var d = JSON.parse(JSON.stringify(data))
            
            
            //console.log('1DEBUG size: ' + store.size)
            
            //BAD console.log('1DEBUG store: ' + store.store)
            console.log('store.store: '+util.inspect(store.store, false, null, true ))
            
            //console.log('1DEBUG has accountInfo: ' + store.has('accountInfo'))
            //console.log('1DEBUG has onlineID: ' + store.has('onlineID'))
            //console.log('1DEBUG has profilePicture: ' + store.has('profilePicture'))
            //var obj = store.get('accountInfo')
            //console.log(util.inspect(obj, false, null, true ))
            //if (obj == undefined) {
            //    console.log('1DEBUG - obj - accountInfo - undef')
            //}
            //console.log('1DEBUG accountInfo: ' + obj)
            console.log('1DEBUG d: ' + d)
            console.log('1DEBUG profile1: ' + d.["profile"])
            console.log('1DEBUG profile1-1: ' + d.['profile'])
            console.log('1DEBUG profile.npId: ' + d.["profile"].npId)
            console.log('1DEBUG profile.npId2: ' + d.["profile"].["npId"])
            console.log('1DEBUG npId: ' + d.profile.npId)
            //console.log('1DEBUG onlineID: ' + d.profile.onlineId)
            

            store.set('onlineID', d.profile.onlineId)
            store.set('profilePicture', d.profile.avatarUrls[1].avatarUrl)
            store.set("accountInfo", d.profile.presences[0])
            updateRPC()
        })
    })

    req.on('error', function (e) {
        console.log('problem with request: ' + e.message)
    })
    req.end()


}

function updateRPC() {
    var obj = store.get('accountInfo')
    console.log('DEBUG accountInfo: ' + obj)
    console.log(obj.platform)
    if (obj.titleName != undefined) {
        client.updatePresence({
            state: 'Playing: ' + obj.titleName,
            details: obj.onlineStatus,
  
            largueImageKey: 'ps4_main',
            instance: true
        })
    } else {
        client.disconnect()
        console.log('not playing')
    }
}

function stopRPC() {
    client.disconnect()
}

app.on('ready', () => {
    createTray()
    createWindow()
    // In main process.
})

const createTray = () => {
    tray = new Tray('site/appicon.png')
    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show', click: function () {
                win.setAlwaysOnTop(true);
                app.show()
            }
        },
        {
            label: 'Hide', click: function () {
                app.hide()
            }
        },
        {
            label: 'Logout', click: function () {
                store.delete('accountInfo')
                app.relaunch()
                app.exit()
            }
        },
        {
            label: 'Close', click: function () {
                app.quit()
            }
        }
    ])
    tray.setToolTip('Electron PS4Rpc')
    tray.setContextMenu(contextMenu)
}
