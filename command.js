var querystring = require('querystring');
var Class = require('neko').Class;

var commands = {
    say: [1, 500, {
        command: function(msg, args) {
            if (args[0] === '!kitten') {
                msg('Nicez trys, but ma tail haz optimized your recursions away!');
            
            } else {
                msg(args.join(' '));
            }
        }
    }],
    
    help: [0, 20, {
        command: function(msg, args) {
            msg('    Kitten gives you help  cmd|reputation [params] (but only every 15 seconds)\n'
                          + '         help|20                     # I show you this! Me deletes it after 30 seconds\n'
                          + '            ?|20    [thing]          # I tell you what me thinks about [thing]\n'
                          + '          say|500   [text]           # I say somethingz for you!\n'
                          + '        think|5000  [thing] [thinks] # makes me think about things...\n'
                          + '          ban|5000  [username|id]    # makes me not like one\n'
                          + '        unban|5000  [username|id]    # makes me like one again\n'
                          + '         bans|2500                   # shows you who I not like\n'
                          + '       wisdom|150   [username|id]    # wise words from [username], Me deletes it after 1 minute',
            30000);
        }
    }],
    
    bans: [0, 1500, {
        command: function(msg, args) {
            if (this.chat.usersBanned.length === 0) {
                msg('**Me likes you all! ^.^"** ');
            
            } else {
                this.chat.getUserInfo(this.chat.usersBanned, function(users) {
                    var names = [];
                    for(var i = 0; i < users.length; i++) {
                        names.push(users[i].name);
                    }
                    msg('**Me not likes:** ' + names.join(', '), 15000); 
                });
            }
       }
    }],
    
    wisdom: [1, 150, {
        command: function(msg, args) {
            console.log('resolving');
            this.chat.resolveUser(args.join(' '), function(id, username) {
                this.getAnswer(msg, id);
            }, this);
        },
        
        $shuffle: function (array) {
            var tmp, current, top = array.length;
            if (top) {
                while(--top) {
                    current = Math.floor(Math.random() * (top + 1));
                    tmp = array[current];
                    array[current] = array[top];
                    array[top] = tmp;
                }
            }
            return array;
        },
        
        getAnswer: function(msg, id) {
            var url = '/api/useranswers.html?pagesize=20&userId=' + id + '&page=1&sort=votes';
            
            var that = this;
            this.chat.simpleRequest('GET', url).end = function(content) {
                var answers = [];
                var data = content.split('<div class="answer-summary">');
                var exp = /'\/questions(.*?)'" class="([a-z\-\s]+).*'>([0-9]+)<\/div>/i;
                for(var i = 0, l = data.length; i < l; i++) {
                    var f = exp.exec(data[i]);
                    if (f) {
                        if (f[2].indexOf('answered-accepted') !== -1 && parseInt(f[3]) >= 9
                            || parseInt(f[3]) >= 15) {
                            
                            answers.push('/questions' + f[1]);
                        }
                    }
                }
                that.$shuffle(answers);
                
                if (answers[0]) {
                    msg('http://' + this.mainURL + answers[0], 60000);
                
                } else {
                    msg('Kitten couldnt find wise words from ' + (username ? username : '#' + id));
                }
            };
        }
    }],
    
    think: [1, 5000, {
        command: function(msg, args) {
            var text = args.slice(1).join(' ').trim();
            var id = args[0].replace(/\+/g, ' ').toLowerCase();
            if (text) {
                this.chat.thougthList[id] = text;
                msg('Thanks u much! Kitten now knows moar!');
            
            } else if (this.chat.thougthList[id]) {
                delete this.chat.thougthList[id];
                msg('Kitten has forgotten... but what?');
            }
        }
    }],
    
    ban: [1, 5000, {
        command: function(msg, args) {
            this.chat.resolveUser(args.join(' '), function(id, username) {
                if (id === this.chat.userID) {
                    msg('Kitten not stupid! **Go away!**');
                
                } else if (this.chat.usersLove.indexOf(id) !== -1) {
                    msg('Kitten *loves* you ' + (username ? username : '#' + id) + ' so does not ban you ^_^"');
                
                } else if (!isNaN(id) && this.chat.usersBanned.indexOf(id) === -1) {
                    this.chat.usersBanned.push(id);
                    if (this.chat.userCache[id]) {
                        this.chat.userCache[id].banned = true;
                        this.chat.userCache[id].banInfo = false;
                    }
                    msg('Me is sorry for banning you ' + (username ? username : '#' + id));
                }
            }, this);
        }
    }],
    
    unban: [1, 5000, {
        command: function(msg, args) {
            this.chat.resolveUser(args.join(' '), function(id, username) {
                if (!isNaN(id) && this.chat.usersBanned.indexOf(id) !== -1) {
                    this.chat.usersBanned.splice(this.chat.usersBanned.indexOf(id), 1);
                    if (this.chat.userCache[id]) {
                        this.chat.userCache[id].banned = false;
                        this.chat.userCache[id].banInfo = false;
                    }   
                    msg('Me likes you again ' + (username ? username : '#' + id) + ' ^.^"');
                }
            }, this);
        }
    }]
};

exports.create = function(chat) {
    var list = {};
    for(var i in commands) {
        var cls = Class(function(chat, name, count, rep) {
            ChatCommand.init(this, chat, name, count, rep);
        
        }, ChatCommand).extend(commands[i][2]);
        list[i] = new cls(chat, commands[i][0], commands[i][1]);
    }
    return list;
};


// Commands --------------------------------------------------------------------
var ChatCommand = Class(function(chat, count, rep) {
    this.chat = chat;
    this.count = count;
    this.rep = rep;

}).extend({
    execute: function(rid, uid, args) {
        var that = this;
        var msg = function(msg, timeout) {
            that.chat.postMessage(msg, rid, timeout);
        };
        
        var now = new Date().getTime();
        var user = this.chat.userCache[uid];        
        if (!user || user.rep < this.rep) {
            return false;
        
        } else if (user.banned) {
            if (!user.banInfo) {
                msg('Kitten doesn\'t like yu ' + user.name + '!');
                user.banInfo = true;
            }
        
        } else if (args.length >= this.count) {
            user.lastCommand = new Date().getTime();
            user.tooFast = false;
            user.banInfo = false;
            this.command(msg, args);
        }
    }
});

