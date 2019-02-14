//const client = require('discord-rich-presence')('457775893746810880')
const client = require('discord-rich-presence')('541917623240097795') //ru ps4

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
	console.log('createWindow+')
    ipcMain.on('get-account-data', (event, arg) => {

        event.sender.send('profile-picture', store.get('profilePicture'))
        event.sender.send('nickname', store.get('onlineID'))
    })


    ipcMain.on('logout-function', (event, arg) => {

        store.delete('accountInfo')
        store.delete('responses')
        store.delete('curgame')
        store.delete('startTimestamp')
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
    console.log('Start Login: ' + store.get('accountInfo'))
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
console.log('createWindow-')
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
        res.setEncoding('utf8')
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
	console.log('CronStart+')
    if (store.get('responses') != undefined) {
        cron.schedule('*/1 * * * *', () => {
			console.log('getPsnPresence_run')
            getPsnPresence()
			console.log('getPsnPresence_done')
        })
	 cron.schedule('*/55 * * * *', () => {
			console.log('refreshToken_run')
            refreshToken()
			console.log('refreshToken_done')
        })
    } else {
		console.log('CronStart-else: '+ store.get('responses'))
        app.relaunch()
        app.exit()
    }
	console.log('CronStart-')
}

function refreshToken() {
	console.log('refreshToken+')
    var tokendata = store.get('responses')
    var object = JSON.parse(tokendata)
    console.log(new Date().toISOString() + "OLD Access token: " + object['access_token'])
    console.log(new Date().toISOString() + "OLD Refresh token: " + object['refresh_token'] + "\n")
	var data = queryString.stringify({
        'grant_type': 'refresh_token',
        'refresh_token': object['refresh_token'],
        'scope': 'psn:clientapp'
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
        res.setEncoding('utf8')
        res.on('data', function (body) {
            store.set('responses', body)
            console.log('new refresh body: ' + body)
            //startCron()
        })
    })
    req.on('error', function (e) {
        console.log('problem with request: ' + e.message)
    })
    req.write(data)
    req.end()

	console.log('refreshToken-')
}

function getPsnPresence() {
	console.log('getPsnPresence+')
    var tokendata = store.get('responses')
    // getting the actual profile data using the token -> check console for it :D
    var object = JSON.parse(tokendata)
    
    //console.log(new Date().toISOString() + "0DEBUG tokendata: " + object)
    
    //console.log(new Date().toISOString() + "Expires_in (sec): " + object['expires_in'])
    //TODO CRON for refresh token
    console.log(new Date().toISOString() + "Access token: " + object['access_token'])
    console.log(new Date().toISOString() + "Refresh token: " + object['refresh_token'] + "\n") // -> to get a new Access token without login, implement later 

    var options = {
        method: 'GET',
        port: 443,
        hostname: 'us-prof.np.community.playstation.net',
        path: '/userProfile/v1/users/me/profile2?fields=npId,onlineId,avatarUrls,plus,aboutMe,languagesUsed,trophySummary(@default,progress,earnedTrophies),isOfficiallyVerified,personalDetail(@default,profilePictureUrls),personalDetailSharing,personalDetailSharingRequestMessageFlag,primaryOnlineStatus,presences(@titleInfo,hasBroadcastData),friendRelation,requestMessageFlag,blocking,mutualFriendsCount,following,followerCount,friendsCount,followingUsersCount&avatarSizes=m,xl&profilePictureSizes=m,xl&languagesUsedLanguageSet=set3&psVitaTitleIcon=circled&titleIconSize=s',
        headers: {
            'Authorization': 'Bearer ' + object['access_token']
        }
    }

    //get info from ps.net
	console.log('get info from ps.net+')
    var req = http.request(options, function (res) {
        var data = ""
        res.setEncoding("utf8")
        res.on('data', function (chunk) {
            data += chunk
        })
        res.on('end', function () {
            //console.log('1DEBUG data: ' + data)
            var d = JSON.parse(data)
	        console.log('res.end data: ' + util.inspect(d, false, null, true ))
            //console.log('store.store: '+util.inspect(store.store, false, null, true ))
            //console.log(util.inspect(obj, false, null, true ))

            if (d.profile != undefined) {
                store.set('onlineID', d.profile.onlineId)
                store.set('profilePicture', d.profile.avatarUrls[1].avatarUrl)
                store.set("accountInfo", d.profile.presences[0])
		store.set("trophySummary", d.profile.trophySummary)
                updateRPC()
                console.log('updateRPC')
            }
            else {
            console.log(new Date().toISOString() + ' profile empty: ' + util.inspect(store.store, false, null, true ))
                
            }
        })
    })

    req.on('error', function (e) {
        console.log('problem with request: ' + e.message)
    })
    req.end()
console.log('get info from ps.net-')
console.log('getPsnPresence-')
}

function updateRPC() {
    var obj = store.get('accountInfo')
    var curgame = store.get('curgame')
    var startTimestamp = store.get('startTimestamp')
    var tS = store.get('trophySummary')
    //console.log(new Date().toISOString() + ' curgame: '+curgame)
    //console.log(new Date().toISOString() + ' startTimestamp: '+startTimestamp)
    //console.log(new Date().toISOString() + ' startTimestamp: '+ typeof(startTimestamp))
    //console.log(new Date().toISOString() + ' obj: '+util.inspect(obj, false, null, true ))
    console.log(new Date().toISOString() + ' trophySummary: '+tS)
  
    //in game
    if (obj.titleName != undefined) {
        
        if (obj.npTitleId!=curgame || curgame == undefined) {
                store.set("curgame", obj.npTitleId)
                store.set("startTimestamp", new Date().getTime() / 1000 | 0)
                console.log('store set1: ', obj.npTitleId)
                console.log('store set2: ', new Date())
            }
            client.updatePresence({
            state: obj.gameStatus,
            //details: obj.onlineStatus,
            details: obj.titleName,
            // Discord automatically lowercases all assets when uploaded.
            largeImageKey: obj.npTitleId.toLowerCase(),
            largeImageText: obj.titleName,
            smallImageKey: 'ps4_small',
            smallImageText: obj.platform,
            startTimestamp: store.get('startTimestamp'),
            instance: true
        })
    } //online only. but LLIYTHUK dont need it. If u need uncomment this code
       //else if (obj.onlineStatus != undefined) {
        //client.updatePresence({
			//state: obj.onlineStatus,
			//largeImageKey: 'ps4_big',
			//instance: true
        //})
    else {
		// client.ClearPresence dont support by lib?
	    //need show it
	//PlayStation 4
	//psn: LLIYTHUK
	//level: 15 (71%)
	//platinum: 22, gold: 95, silver: 342, bronze: 1531
	        client.updatePresence({
			 state: 'level: ' + tS.level + '(' + tS.progress+ '%)',
		         details: 'platinum: '+tS.earnedTrophies.platinum + 
				  ', gold: '+tS.earnedTrophies.gold +
				  ', silver: '+tS.earnedTrophies.silver +
				  ', bronze: '+tS.earnedTrophies.bronze,
			 instance: true
        })
        //client.disconnect()
        //console.log('ClearPresence - not playing status')
    }
    

}

function stopRPC() {
	console.log('stopRPC')
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
