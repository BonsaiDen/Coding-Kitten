var querystring = require('querystring');
var Class = require('neko').Class;

var commands = {
    say: [1, 500, {
        command: function(msg, args) {
            if (args[0] === '!kitten') {
                msg('Nice try, did you really think that would work? I mean, are you really *that* stupid?');
            
            } else {
                msg(args.join(' '));
            }
        }
    }],
    
    help: [0, 20, {
        command: function(msg, args) {
            msg('    Just because I have mercy with you:\n'
                          + '     help  |  20                   # Shows the help, for 30 seconds.\n'
                          + '     ?     |  20  [thing]          # Ask me about my opinion on something.\n'
                          + '     say   | 500  [text]           # Let me say something for you, it will instantly\n'
                          + '                                       sound a trillion times smarter.\n'
                          + '     think |5000  [thing] [thinks] # Tell me something intersting, or just don\'t talk at all.\n'
                          + '     ban   |5000  [username|id]    # Make an educates guess what that could possibly do.\n'
                          + '     unban |5000  [username|id]    # Unbans. But why? You banned him for a reason.\n'
                          + '                                       Or just for fun, like I do all the time.\n'
                          + '     bans  |2500                   # A list of *people*.\n'
                          + '     wisdom| 150  [username|id]    # Get some wisdom, but better get it quick,\n'
                          + '                                     since it will only stay 1 minute,',
            30000);
        }
    }],
    
    bans: [0, 1500, {
        command: function(msg, args) {
            if (this.chat.usersBanned.length === 0) {
                msg('**Nobody\'s banned**. WTF? Your kidding me, I\'d ban half the internet if I could, but well your decision...');
            
            } else {
                this.chat.getUserInfo(this.chat.usersBanned, function(users) {
                    var names = [];
                    for(var i = 0; i < users.length; i++) {
                        names.push(users[i].name);
                    }
                    msg('These people are **banned**, you better like kittens otherwise you\'ll join them **very soon**: ' + names.join(', '), 15000); 
                });
            }
       }
    }],
    
    wisdom: [1, 150, {
        command: function(msg, args) {
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
                    msg('Guess you\'re out of luck with ' + (username ? username : '#' + id) + '. *Yawn* I nearly fell a sleep when checking his answers.');
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
                msg('**' + id +'**? Sounds tnteresting, gonna write that down, yes on *real* paper, and no, papers\'s not edible.');
            
            } else if (this.chat.thougthList[id]) {
                delete this.chat.thougthList[id];
                msg('Well let\'s just forget about **' + id +'** then, I have better things to remeber anyways.');
            }
        }
    }],
    
    ban: [1, 5000, {
        command: function(msg, args) {
            this.chat.resolveUser(args.join(' '), function(id, username) {
                if (id === this.chat.userID) {
                    msg('Seriously, do you think I\'m stupid? Better get out, before I use my kitten eyes and force you into deleting your own account.');
                
                } else if (this.chat.usersLove.indexOf(id) !== -1) {
                    msg('They may say that cats are not loyal, but I consider friendship serious buisness pal. In short: No ban for ' + (username ? username : '#' + id));
                
                } else if (!isNaN(id) && this.chat.usersBanned.indexOf(id) === -1) {
                    this.chat.usersBanned.push(id);
                    if (this.chat.userCache[id]) {
                        this.chat.userCache[id].banned = true;
                        this.chat.userCache[id].banInfo = false;
                    }
                    msg('Congratulations ' + (username ? username : '#' + id) + ' you have been rewarded with the [BANNED]-Badge.');
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
                    msg('*How much* did you pay them for **that** ' + (username ? username : '#' + id) + '? Whatever consider your self lucky... this time...');
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

