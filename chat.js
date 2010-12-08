var http = require('http');
var querystring = require('querystring');
var fs = require('fs');
var html = require('./html');
var Class = require('neko').Class;
var command = require('./command');


// Chat Bot --------------------------------------------------------------------
// -----------------------------------------------------------------------------
var ChatBot = Class(function(config, rooms) {
    this.config = this.$loadFile(config);
    
    // Static things
    this.joinList = rooms;
    this.commands = command.create(this);
    this.userID = config.userID;
    
    // Chat
    this.chatKey = '';
    this.chatTimes = {};
    this.chatPending = {};
    this.running = false;
    
    this.rooms = [];
    this.messageList = [];
    this.userCache = {};
    
    // Specials
    this.thougthList = this.$loadFile('answers.list') || {};
    
    // Hosts
    this.mainURL = this.config.site;
    this.mainHost = http.createClient(80, this.mainURL);
    this.chatURL = 'chat.' + this.mainURL;
    this.chatHost = http.createClient(80, this.chatURL);
    
    // Users
    this.usersLove = [170224, 419970, 94197, 13249, 181481]; // Ivo, Raynos, Andy E, Nick Craver, rchern
    this.usersBanned = this.$loadFile('bans.list') || [];
    
    // Load saved login or get a new one
    try {
        var login = fs.readFileSync('exchange.login');
        this.exchangeCookie = login.toString();
        this.joinRooms();
    
    } catch(e) {
        this.openIDCookie = '';
        
        // here be dragons....
   //     this.getOpenID();    
    }
    
    
    var that = this;
    process.on('SIGINT', function() {
        that.leaveRooms(function() {
            process.exit();
        });
    });

}).extend({
    update: function() {
        for(var i = 0, l = this.rooms.length; i < l; i++) {
            var rid = this.rooms[i];
            if (!this.chatPending[rid] === undefined) {
                this.chatPending[rid] = false;
            }
            
            if (!this.chatPending[rid]) {
                this.chatPending[rid] = true;
                this.getEvents(rid);
            }
        }
        
        var that = this;
        setTimeout(function(){that.update();}, 200);
    },
    
    joinRooms: function() {
        for(var i = 0, l = this.joinList.length; i < l; i++) {
            this.joinRoom(this.joinList[i]);
        }
    },
    
    leaveRooms: function(callback) {
        var leave = this.rooms.slice(0);
        var leaveCount = leave.length
        for(var i = 0, l = leaveCount; i < l; i++) {
            this.leaveRoom(leave[i], function() {
                leaveCount--;
                if (leaveCount === 0) {
                    callback();
                }
            });
        }
    },
    
    log: function(msg) {
        console.log(msg);
    },
    
    
    // Rooms -------------------------------------------------------------------
    leaveRoom: function(rid, callback) {
        this.log('[LEAVING] ' + rid);
        this.chatRequest('POST', '/chats/leave/' + rid, {'quiet': true}).end = function(res) {
            this.log('[LEFT] ' + rid);
            fs.writeFileSync('bans.list', JSON.stringify(this.usersBanned));
            fs.writeFileSync('answers.list', JSON.stringify(this.thougthList));
            this.rooms.splice(this.rooms.indexOf(rid, 1));
            callback();
        };
    },
    
    joinRoom: function(rid) {
        this.chatRequest('GET', '/rooms/' + rid).end = function(content) {
            var match = /me="fkey" type="hidden" value="(.*?)"/.exec(content);
            if (match) {
                this.log('[JOINED] ' + rid);
                this.rooms.push(rid);
                this.chatKey = match[1];
               // this.postMessage('Me is back!', rid);
                if (!this.running) {
                    this.running = true;
                    this.update();
                }
            
            } else {
                this.log('[FAILED] ' + rid);
            }
        };
        this.log('[JOINING] ' + rid);  
    },
    

    // Events ------------------------------------------------------------------
    getEvents: function(rid) {
        var options = {};
        var url = '/events';
        
        if (!this.chatTimes[rid]) {
            this.chatTimes[rid] = {last: -1, init: -1}
        }
        
        if (this.chatTimes[rid].last === -1) {
            options.since = 0;
            options.mode = 'Messages';
            options.msgCount = 2;
            url = '/chats/' + rid + '/events';
        
        } else {
            options['r' + rid] = this.chatTimes[rid].last;
        }
        
        this.chatRequest('POST', url, options).end = function(content) {
            var events = JSON.parse(content.toString());      
            if (events.events) {
                var last = events.time;
                if (last > this.chatTimes[rid].last) {
                    this.chatTimes[rid].last = last;
                }
                this.parseMessages(rid, events.events, true);
            
            } else {
                events = events['r' + rid];
                if (events.e) {
                    var last = events.t;
                    this.chatTimes[rid].init = last;
                    if (last > this.chatTimes[rid].last) {
                        this.chatTimes[rid].last = last;
                    }
                    this.parseMessages(rid, events.e, false);
                }
            }
            this.chatPending[rid] = false;
        };
    },
    
    
    // Messages ----------------------------------------------------------------
    handleCommand: function(rid, uid, uname, msg) {
        var parts = msg.split(' ').slice(1);
        if (parts.length >= 1) {
            console.log(rid, uid, uname, msg);
            if (parts[0] === '?' || !this.commands[parts[0]]) {
                var args = parts[0] === '?' ? parts.slice(1) : parts;
                this.postMessage(this.thougthList[args.join(' ').toLowerCase()] 
                                 || 'Me not knows ' + args.join(' ') + '... you knows it?', rid);
            
            } else if (this.commands[parts[0]]) {
                this.log('[COMMAND ' + parts[0].toUpperCase() + ' #' + rid + '] ' + uname);
                this.commands[parts[0]].execute(rid, uid, parts.slice(1));
            }
        }
    },
    
    handleMessage: function(rid, msg, init) {
        switch(msg.event_type) {
            case 1:
                var content = msg.content;
                if (content) {
                    content = this.$unescapeHTML(content.trim().replace(/\s+/g, ' '));
                    if (msg.user_id !== this.userID
                        && content.substring(0, 8) === '!kitten ' && !init) {
                        
                        this.handleCommand(rid, msg.user_id, msg.user_name, content);
                    }
                }
                break;
            
            case 3:
                this.log('[JOINED #' + rid + '] ' + msg.user_name);
                break;
            
            case 4:
                this.log('[LEFT#' + rid + '] ' + msg.user_name);
                break;
            
            default:
                break;
        }
    },

    parseMessages: function(rid, list, init) {
        var now = new Date().getTime();
        var users = [];
        for(var i = 0, l = list.length; i < l; i++) {
            var msg = list[i];
            if (this.messageList.indexOf(msg.message_id) === -1) {
                this.messageList.push(msg.message_id);
                this.handleMessage(rid, msg, init);
                
                var uid = msg.user_id;
                if (uid && users.indexOf(uid) === -1 && msg.event_type !== 4) {
                    if (!this.userCache[uid] || now - this.userCache[uid].lastUpdate > 600000) {
                        users.push(uid);
                    }
                }
            }
        }
        
        var more = this.messageList.length - 30;
        if (more > 0) {
            this.messageList.splice(0, more);
        }
        if (users.length > 0) {
            this.getUserInfo(users, function(users) {
                this.cacheUser(users);
            });
        }
    },
    
    postMessage: function(msg, rid, timeout) {
        var req = this.chatRequest('POST', '/chats/' + rid + '/messages/new', {'text': msg});
        req.response = function(res) {
            this.log('[POSTED #' + rid + '] ' + msg);
        };
        
        if (timeout) {
            req.end = function(content) {
                var msg = JSON.parse(content.toString());
                var that = this;
                setTimeout(function(){
                    that.deleteMessage(msg.id);
                
                }, timeout);
            };
        }
    },
    
    deleteMessage: function(id) {
        this.chatRequest('POST', '/messages/' + id + '/delete', {}).response = function (res) {
            this.log('[DELETED] ' + id);
        };
    },
    
    
    // Users -------------------------------------------------------------------
    getUserInfo: function(uids, callback) {
        this.chatRequest('POST', '/user/info', {'ids': uids.toString()}).end = function(content) {
            var users = JSON.parse(content.toString());
            this.log('[USERS] ' + users.users.length);  
            callback.call(this, users.users);
        };
    },

    getUserData: function(name, callback) {
        var url = '/users/filter/' + querystring.escape(name.toLowerCase())
                  + '?_=' + new Date().getTime() + '&tab=Reputation';
        
        this.simpleRequest('GET', url).end = function(content) {
            var id = /href="\/users\/([0-9]+)\//.exec(content);
            var name = /\" >(.*?)<\/a></.exec(content);
            if (id) {
                this.log('[USERDATA] ' + parseInt(id[1]) + ' ' + name[1]);
                callback.call(this, parseInt(id[1]), name[1]);
            }
        };
    },
    
    resolveUser: function(user, callback, that) {
        var id = parseInt(user);
        var name = user.trimLeft('@').trim();
        var username = null;
        for(var i in this.userCache) {
            var user = this.userCache[i];
            if (user.name === name) {
                id = parseInt(i);
                username = name;
                break;
            }
        }
        
        if (!isNaN(id) && username !== null) {
            callback.call(that, id, username);
        
        } else {
            this.getUserData(name, function(id, name) {
                callback.call(that, id, name);
            });
        }
    },
    
    cacheUser: function(users) {
        for(var i = 0, l = users.length; i < l; i++) {
            var user = users[i];
            if (this.userCache[user.id]) {
                this.log('[UPDATE CACHE] ' + user.name);
                this.userCache[user.id].name = user.name;
                this.userCache[user.id].rep = user.reputation;
                this.userCache[user.id].lastUpdate = new Date().getTime();
            
            } else {
                this.log('[INIT CACHE] ' + user.name);
                this.userCache[user.id] = {
                    'name': user.name,
                    'rep': user.reputation,
                    'lastUpdate': new Date().getTime(),
                    'lastCommand': new Date().getTime(),
                    'tooFast': false,
                    'banInfo': false,
                    'banned': this.usersBanned.indexOf(user.id) !== -1
                };
            }
        }
    },
    
    
    // Requests ----------------------------------------------------------------
    simpleRequest: function(method, url, data) {
        return this.baseRequest(this.mainHost, this.mainURL, method, url, data);
    },
    
    chatRequest: function(method, url, data) {
        return this.baseRequest(this.chatHost, this.chatURL, method, url, data);
    },
    
    baseRequest: function(base, site, method, url, data) {
        var header = {
            'Host': site,
            'Cookie': this.exchangeCookie,
            'Referer': 'http://' + site,
            'X-Requested-With': 'XMLHttpRequest',
            'Origin': 'http://' + site
        };
        
        if (data) {
            data['fkey'] = this.chatKey;
            data = querystring.stringify(data);
            header['Content-Length'] = data.length;
            header['Content-Type'] = 'application/x-www-form-urlencoded';
        }
        
        var events = {};
        var req = base.request(method, url, header);
        
        var that = this;
        req.on('response', function (res) {
            events.response && events.response.call(that, res);
            var content = '';
            res.on('data', function (chunk) {
                content += chunk.toString();
            });
            
            res.on('end', function() {
                events.end && events.end.call(that, content);
                delete content;
            });
        });
        if (data) {
            req.write(data);
        }
        req.end();
        return events;
    },
    
    
    // Static ------------------------------------------------------------------
    $unescapeHTML: function(text) {
        return html.unescape(text);
    },
    
    $loadFile: function(file) {
        try {
            return JSON.parse(fs.readFileSync(file).toString());
        
        } catch (e) {
            return null;
        }
    },
    
    
    // OpenID and SO login -----------------------------------------------------
    // -------------------------------------------------------------------------
    $parseCookies: function(cookies) {
        var parsed = [];
        for(var i = 0; i < cookies.length; i++) {
            var c = cookies[i].split(';');
            parsed.push(c[0]);
        }
        return parsed;
    },
        
    getOpenID: function(id) {
        var that = this;
        var openSite = http.createClient(443, 'www.myopenid.com', true);
        var req = openSite.request('GET', 'https://www.myopenid.com/signin_password', {'host': 'www.myopenid.com'});
        req.on('response', function (res) {
            that.log('[COMPLETE] OpenID');
            
            var data = {'cookies': that.$parseCookies(res.headers['set-cookie']).join('; ') + ';'};
            res.on('data', function (chunk) {
                
                // The <center> cannot hold it is too late.
                data.tid = /name="tid" value="(.*?)"/.exec(chunk)[1];
                data.token = /name="token" value="(.*?)"/.exec(chunk)[1];
                data._ = /name="_" value="(.*?)"/.exec(chunk)[1].substring(1);
                that.log('Login data:', data.tid, data.token, data._);
                that.getOpenIDLogin(id, data);
            });
        });
        
        this.log('[INIT] OpenID');
        req.end();
    },

    getOpenIDLogin: function(id, data) {
        var that = this;
        var form = querystring.stringify({'password': id.secret, 'user_name': id.name,
                                          'tid': data.tid, 'token': data.token, '_': data._});
        
        var openSite = http.createClient(443, 'www.myopenid.com', true);
        var req = openSite.request('POST', 'https://www.myopenid.com/signin_submit'+ '?' + form + '&needs_auth=True',
                                           {'Host': 'www.myopenid.com',
                                            'Cookie': data.cookies,
                                            'Origin': 'https://www.myopenid.com',
                                            'Referer': 'https://www.myopenid.com/signin_password',
                                            'Content-Type': 'application/x-www-form-urlencoded',
                                            'Content-Length': form.length});
        
        req.on('response', function (res) {
            that.log('[COMPLETE] OpenID');
            that.openIDCookie = that.$parseCookies(res.headers['set-cookie']).join('; ') + ';';
            that.onOpenIDDone(id);
        });
        this.log('[LOGIN] OpenID');  
        req.end(form);
    },
    
    onOpenIDDone: function(id) {   
        var that = this;
        var url = '/server?openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.return_to=http%3A%2F%2Fstackoverflow.com%2Fusers%2Fauthenticate%2F%3Fs%3D869da063-5dcb-4fb3-8ed8-e6baafb7d6d6%26dnoa.userSuppliedIdentifier%3Dhttp%253A%252F%252Fmyopenid.com%252F&openid.realm=http%3A%2F%2Fstackoverflow.com%2Fusers%2Fauthenticate%2F&openid.mode=checkid_setup&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0&openid.ns.alias3=http%3A%2F%2Fopenid.net%2Fsrv%2Fax%2F1.0&openid.alias3.if_available=alias1%2Calias2%2Calias3%2Calias4&openid.alias3.mode=fetch_request&openid.alias3.type.alias1=http%3A%2F%2Fschema.openid.net%2FnamePerson&openid.alias3.count.alias1=1&openid.alias3.type.alias2=http%3A%2F%2Fschema.openid.net%2Fcontact%2Femail&openid.alias3.count.alias2=1&openid.alias3.type.alias3=http%3A%2F%2Faxschema.org%2FnamePerson&openid.alias3.count.alias3=1&openid.alias3.type.alias4=http%3A%2F%2Faxschema.org%2Fcontact%2Femail&openid.alias3.count.alias4=1';
        var openSite = http.createClient(443, 'www.myopenid.com', true);
        var req = openSite.request('GET', url, {'Host': 'www.myopenid.com',
                                                'Cookie': this.openIDCookie,
                                                'Origin': 'https://www.myopenid.com',
                                                'Referer': 'http://' + id.mainHost
                                                            + '/users/login?returnurl=/users/'
                                                            + id.exchangeID + '/'
                                                            + id.exchangeUser});
        
        req.on('response', function (res) {
            that.log('[COMPLETE] OpenID');
            that.onExchangeLogin(id, res.headers.location);
        });
        this.log('[AUTH] OpenID');  
        req.end();
    },
    
    onExchangeLogin: function(id, path) {
        var that = this;
        var mainHost = http.createClient(80, id.mainHost);
        var req = mainHost.request('GET', '/users' + path.split('/users')[1],
                                              {'Host': id.mainHost,
                                               'Cookie': this.exchangeCookie,
                                               'Origin': 'http://' + id.mainHost});
        
        req.on('response', function (res) {
            that.log('[COMPLETE]' + id.mainHost);
            that.exchangeCookie = that.$parseCookies(res.headers['set-cookie']).join('; ') + ';';
            fs.writeFileSync('exchange.login', that.exchangeCookie);
            that.joinRooms();
        });
        this.log('[AUTH] ' + id.mainHost);  
        req.end();
    }
});

//process.on('uncaughtException', function(err) {
//    console.log(err.message);
//    console.log(err.stack);
//});

var bot = new ChatBot('config', [1, 17]);

