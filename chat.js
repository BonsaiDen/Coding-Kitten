/*
   Copyright (c) 2010-2011 Ivo Wetzel.

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in
   all copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
   THE SOFTWARE.
*/

var http = require('http');
var querystring = require('querystring');
var fs = require('fs');
var html = require('./html');

var Class = require('neko').Class;
var OpenLogin = require('./login').OpenLogin;
var command = require('./command');

var reply = require('./reply');


// Kitten ----------------------------------------------------------------------
// -----------------------------------------------------------------------------
var Kitten = Class(function(config) {
    this.config = this.$loadFile(config);

    // Static things
    this.joinList = this.$loadFile('rooms.list') || this.config.rooms;
    if (this.joinList.length === 0) {
        this.joinList = this.config.rooms;
    }
    this.commands = command.create(this);
    this.userID = this.config.userID;

    // Chat
    this.preloadMessages = false; // this is not compeletely implemented...
    this.chatKey = '';
    this.chatLastTime = {};
    this.chatPending = {};
    this.chatPing = {};
    this.chatLastPing = {};
    this.chatReJoin = {};
    this.chatCookies = {};
    this.chatLog = this.$loadFile('messages.list') || [];
    this.running = false;
    reply.init(this.chatLog);


    this.rooms = [];
    this.messageList = [];
    this.userCache = {};

    // Specials
    this.thougthList = this.$loadFile('thoughts.list') || {};

    var stuff = {
        "roll":"http://www.youtube.com/watch?v=mv5qzMtLE60",
        "ninja":"Coding Ninjas? Aren't Ninjas supposed to be  *agile*,*concise*, *know what they do* and be able to survive without any help? And what\'s a coder? Yeah, most of them can\'t even survive without static typing.",
        "crockford": "Ah good ol\' Crock, you read his book, haven\'t you? Now let me tell you a little secret, I\'ve written half of it, why? Well Doug was busy kicking the IE-Team\'s buts.",
        "answer to life":"42.000000000001 *Luckily they don\'t have this floating point bullshit in the future.*",
        "java":"Everytime you say Java, I kill a carpet. *Twice*.",
        "kitten":"That\'s my name. Well actually my full name is Kitten Gustaf Theodor Johanson of Rijkvek the 4th, sounds *impressive* hm? You know what else sounds impressive? **Leave me alone &!%$&!**",
        "recursion":"Still using recursion? That\'s such a one dimensional concept, I compute my stuff with a quantum map reduce.",
        "help":"There you go: http://stackoverflow.com/questions/ask Now leave me alone with the nonsense you call 'Problems', get a degree in Quatum Subspace Mechanics and *then* we can talk again.",
        "nick craver":"Nick? Yeah I remember that guy, he breaks *everything*, but he sure is the SO King of jQuery!",
        "your mom":"**echo 'Your mom is sooooo fat!' | less** You get that? Damn, Unix geeks.",
        "regex":"http://stackoverflow.com/questions/1732348/regex-match-open-tags-except-xhtml-self-contained-tags/1732454#1732454",
        "regexp":"See 'regex', having the URL in here twice doesn\'t fit the DRY principal.",
        "eval":"So you want to summon *them*, the horrible abominations of hell, you want to open the gates of the apocalypse and doom us all? Well, hold on a second then. ***Doug here\'s someone who want\'s to talk with you!***",
        "cheezburger":"**I can haz cheezburger?** Happy now..."//,
//        "good parts":"",
//        "bad parts":"",
//        "ie": "",
//        "opera":"",
//        "firefox":"",
//        "chrome":"",
//        "safari":""
    };
    for(var i in stuff) {
        this.thougthList[i] = stuff[i];
    }

    // Hosts
    this.mainURL = this.config.site;
    this.chatURL = 'chat.' + this.mainURL;

    this.mainHost = http.createClient(80, this.mainURL);
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
        this.getOpenID();
    }

    var that = this;
    var saved = false;
    process.on('SIGINT', function() {
        if (!saved) {
            fs.writeFileSync('rooms.list', JSON.stringify(that.rooms));
            fs.writeFileSync('messages.list', JSON.stringify(that.chatLog));
            saved = true;
        }

        that.leaveRooms(function() {
            process.exit();
        });
        setTimeout(function() {
            process.exit();
        }, 5000);
    });

}, OpenLogin).extend({
    update: function() {
        for(var i = 0, l = this.rooms.length; i < l; i++) {
            var rid = this.rooms[i];
            if (this.chatPending[rid] === undefined) {
                this.chatPending[rid] = false;
                this.chatPing[rid] = 250;
                this.chatLastPing[rid] = new Date().getTime();
            }

            if (!this.chatPending[rid]
                && new Date().getTime() - this.chatLastPing[rid] > this.chatPing[rid]) {
                this.chatPending[rid] = true;
                this.getEvents(rid);
                this.chatPing[rid] += 100;

                if (this.chatPing[rid] > 3000) {
                    this.chatPing[rid] = 3000;
                }
            }
        }

        var that = this;
        setTimeout(function(){that.update();}, 100);
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
        this.chatRequest('POST', '/chats/leave/' + rid,
                         {'quiet': true}).end = function(res) {

            this.log('[LEFT] ' + rid);
            this.rooms.splice(this.rooms.indexOf(rid, 1));
            clearTimeout(this.chatReJoin[rid]);

            fs.writeFileSync('bans.list', JSON.stringify(this.usersBanned));
            fs.writeFileSync('thoughts.list', JSON.stringify(this.thougthList));
            callback && callback();
        };
    },

    joinRoom: function(rid) {
        this.chatRequest('GET', '/rooms/' + rid).end = function(content) {
            var that = this;

            // Get Key and start session
            var match = /me="fkey" type="hidden" value="(.*?)"/.exec(content);
            if (match) {
                if (this.rooms.indexOf(rid) === -1) {
                    this.rooms.push(rid);
                    this.log('[JOINED] ' + rid);

                } else {
                    this.log('[RE-JOINED] ' + rid);
                }

                this.chatKey = match[1];
                if (!this.running) {
                    this.running = true;
                    this.update();
                }

                // Cache users
                try {
                    var exp = /StartChat([^]*?)chat\.sidebar\.loadingFinished/gim;
                    var script = exp.exec(content)[1];
                    exp = /chat\.sidebar\.loadUser\(([0-9]+?), \("/gm;

                    var m, list = [];
                    while (m = exp.exec(script)) {
                        list.push(+m[1]);
                    }
                    this.getUserInfo(list, function(users) {
                        this.cacheUser(users);
                    });

                } catch(e) {
                    this.log('[INITIAL USER CACHE FAILED] ' + e);
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

        if (this.chatLastTime[rid] === undefined) {
            this.chatLastTime[rid] = -1;
        }

        if (this.chatLastTime[rid] === -1) {
            options.since = 0;
            options.mode = 'Messages';
            options.msgCount = this.preloadMessages ? 200 / this.joinList.length : 0;
            url = '/chats/' + rid + '/events';

        } else {
            options['r' + rid] = this.chatLastTime[rid];
            options.cookie = this.chatCookies[rid];
        }

        var that = this;
        var timeout = setTimeout(function() {
            that.chatPending[rid] = false;
            console.log('ping timeout', rid);

        }, 5000);

        this.chatRequest('POST', url, options).end = function(content, res) {
            clearTimeout(timeout);
            if (res.headers['set-cookie']) {
                this.chatCookies[rid] = this.$parseCookies(res.headers['set-cookie']);
            }

            this.chatLastPing[rid] = new Date().getTime();
            var events = JSON.parse(content.toString());
            if (events.events) {
                var last = events.time;
                if (last > this.chatLastTime[rid]) {
                    this.chatLastTime[rid] = last;
                }
                if (this.preloadMessages) {
                    this.parseMessages(rid, events.events, true);
                }

            } else {
                for(var i in events) {
                    if (events.hasOwnProperty(i)) {
                        var messages = events[i];
                        var id = +i.substring(1);
                        if (messages.e) {
                            if (messages.t > this.chatLastTime[rid]) {
                                this.chatLastTime[rid] = messages.t;
                            }
                            this.parseMessages(id, messages.e, false);
                        }
                        if (messages.reset) {
                            this.chatLastTime[id] = -1;
                            this.joinRoom(id);
                        }
                    }
                }
            }
            this.chatPending[rid] = false;
        };
    },


    // Messages ----------------------------------------------------------------
    handleCommand: function(rid, uid, uname, msg) {
        var parts = msg.split(' ').slice(1);
        if (parts.length >= 1) {
            var cmd = parts[0].toLowerCase();
            if (cmd === '?' || !this.commands[cmd] && cmd !== 'question') {
                var args = cmd === '?' ? parts.slice(1) : parts;
                this.commands.question.execute(rid, uid, args);

            } else if (this.commands[parts[0]]) {
                this.log('[COMMAND ' + parts[0].toUpperCase() + ' #' + rid + '] ' + uname);
                this.commands[parts[0]].execute(rid, uid, parts.slice(1));
            }
        }
    },

    $regex: [
        /.*(can|may)(?:\s|\s.*?\s)(you|one|i|they)(?:\s|\s.*?\s)ask(?:\s|\s.*?\s)(you|something|question).*?\?/i,
        /.*(how|can)(?:\s|\s.*?\s)(can|i|does|one|you)\s(.*)\?/i,
        /.*(why)(?:'s|)(?:\s|\s.*?\s)(does|can|should)\s(.*?)\?/i,
        /.*(what|who|where)(?:'s|)(?:\s|\s.*?\s)(is|a|does|do|was|get|thinks)\s.*?\s(possible|doable)\s(.*?)\?/i,
        /.*(what|who|where)(?:'s|)(?:\s|\s.*?\s)(is|a|does|do|was|get|the)\s(.*?)\?/i,
        /.*(why)(?:'s|)(?:\s|\s.*?\s)(do|is|has)(?:\s|\s.*?\s)(you|it|he|they)\s(.*?)\?/i,
        /.*(what)(?:'s|)(?:\s|\s.*?\s)(are|do|does|did)(?:\s|\s.*?\s)(you|they|he)(?:\s|\s.*?\s)(using|doing|try|use)\?/i,
        /.*(what)(?:'s|)(?:\s|\s.*?\s)(does|did|can)(?:\s|\s.*?\s)(do|you|i|they|one)\s(.*)\?/i,
        /.*(how|is)(?:'s|)(?:\s|\s.*?\s)(do|you|one|it|i|they|that)(?:\s|\s.*?\s)(you|give|do|can|possible|come|doable)\s(.*?)\?/i
    ],

    parseQuestion: function(q, rid) {
        var id = -1, m;
        for(var i = 0, l = this.$regex.length; i < l; i++) {
            m = this.$regex[i].exec(q);
            if (m) {
                id = i;
                break;
            }
        }
        if (id != -1) {
            this.postMessage('    Matched: ' + this.$regex[id].toString() + '\n' + m.slice(1), rid, 60000);
        }
    },

    handleMessage: function(rid, msg, init) {
        if (this.preloadMessages) {
            return;
        }
        switch(msg.event_type) {
            case 8:
            case 1:
                if (msg.content && msg.content.substring(0, 4) !== '    ') {
                    if (rid === 1 && msg.user_id !== this.userID) {
                        this.parseQuestion(this.$unescapeHTML(msg.content.trim()), rid);
                    }

                    var data = msg.content.toLowerCase();
                    if (data.indexOf(':kitten') === -1 && data.indexOf('!kitten') === -1 && msg.user_id !== this.userID) {
                        if (rid !== 1
                            && data.indexOf('function') === -1
                            && data.indexOf('//') === -1) {

                            var text = this.$unescapeHTML(msg.content.trim().replace(/\s+/g, ' ').replace(/<.*?>/g, '').replace(/@[^\s]+/gi, ''));
                            this.chatLog.push(text.trim());

                            var more = this.chatLog.length - 500;
                            if (more > 0) {
                                this.chatLog.splice(0, more);
                            }
                        }
                        if (data.indexOf('@codingkitten') === 0) {
                            this.commands.reply.execute(rid, msg.user_id, [msg]);
                            break;
                        }
                    }
                }

                var content = msg.content;
                if (content) {
                    if (content.substring(0, 4) === '    ') {
                        // ???
                    }
                    content = this.$unescapeHTML(content.trim().replace(/\s+/g, ' '));
                    var cmd = content.substring(0, 8);
                    if (msg.user_id !== this.userID
                        && (cmd === ':kitten ' || cmd === '!kitten ') && !init) {

                        this.handleCommand(rid, msg.user_id, msg.user_name,
                                           content);
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
                this.handleMessage(msg.room_id, msg, init);

                var uid = msg.user_id;
                if (uid && users.indexOf(uid) === -1 && msg.event_type !== 4) {
                    if (!this.userCache[uid]
                        || now - this.userCache[uid].lastUpdate > 600000) {

                        users.push(uid);
                    }
                }
            }
        }
        if (list.length > 0) {
            this.chatPing[rid] -= 1000;
        }
        if (this.chatPing[rid] < 250) {
            this.chatPing[rid] = 250;
        }

        var more = this.messageList.length - 80;
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
        var tries = 0;
        function again() {
            if (tries < 3) {
                tries++;
                this.log('[POST ERROR #' + tries + ']');
                this.sendMessage(msg, rid, timeout, again);
            }
        }
        this.sendMessage(msg, rid, timeout, again);
    },

    sendMessage: function(msg, rid, timeout, callback) {
        var req = this.chatRequest('POST', '/chats/' + rid + '/messages/new',
                                   {'text': msg});

        req.response = function(res) {
            this.log('[POSTED #' + rid + '] ' + msg);
        };

        req.end = function(content) {
            var that = this;
            try {
                var data = JSON.parse(content.toString());
                if (timeout) {
                    setTimeout(function(){
                        that.deleteMessage(data.id);

                    }, timeout);
                }

            } catch(e) {
                callback && callback.call(this);
            }
        };
    },

    deleteMessage: function(id) {
        var req = this.chatRequest('POST', '/messages/' + id + '/delete', {});
        req.response = function (res) {
            this.log('[DELETED] ' + id);
        };
    },


    // Users -------------------------------------------------------------------
    getUserInfo: function(uids, callback) {
        var req = this.chatRequest('POST', '/user/info',
                                   {'ids': uids.toString()});

        req.end = function(content) {
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
                this.log('[USERDATA] ' + +id[1] + ' ' + name[1]);
                callback.call(this, +id[1], name[1]);
            }
        };
    },

    resolveUser: function(user, callback, that) {
        var id = +user;
        var name = user.trimLeft('@').trim();
        var username = null;
        for(var i in this.userCache) {
            var user = this.userCache[i];
            if (user.name === name) {
                id = +i;
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
        var cookies = this.exchangeCookie.trim(';').split(';');
        if (data && data.cookie) {
            cookies.push(data.cookie);
            delete data['cookies'];
        }

        var header = {
            'Host': site,
            'Cookie': cookies.join('; ') + ';',
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
                events.end && events.end.call(that, content, res);
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
    }
});

process.on('uncaughtException', function(err) {
    console.log(err.message);
    console.log(err.stack);
});

new Kitten(process.argv[2] || 'config');

