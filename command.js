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

var querystring = require('querystring');
var http = require('http');

var Class = require('neko').Class;
var reply = require('./reply');


// A giant list of commands the kitten can perform ----------------------------
// ----------------------------------------------------------------------------
var commands = {
    say: [1, 500, { // arg count, rep minimun
        command: function(msg, args) {
            if (args[0] === '!kitten') {
                msg('Nice try, did you really think that would work? I mean, are you really *that* stupid?');

            } else {
                msg(args.join(' '));
            }
        }
    }],

    help: [0, 200, {
        command: function(msg, args) {
            msg('    Just because I have mercy with you:\n'
                          + '     help   |  200                   # Shows the help for 2 minutes.\n'
                          + '     ?      |  200  [thing]          # Ask me about my opinion on something.\n'
                          + '     rchern |  200                   # I tell you one of the infamous rchernisms.\n'
                          + '     wisdom |  250  [username|id]    # I\'ll show you some wise words but only for 1 minute.\n'
                          + '     wob    |  500                   # I\'ll spin the wheel of blame for you.\n'
                          + '     say    |  500  [text]           # Let me say something for you, it will instantly\n'
                          + '                                       sound a trillion times smarter.\n'
                          + '     think  | 5000  [thing] [thinks] # Tell me something intersting, or just don\'t talk at all.\n'
                          + '     ban    | 5000  [username|id]    # Make an educated guess what that could possibly do.\n'
                          + '     unban  | 5000  [username|id]    # Unbans. But why? You banned him for a reason.\n'
                          + '                                       Or just for fun, like I do all the time.\n'
                          + '     bans   | 2500                   # A list of *people*.\n'
                          + '     js[types|truth|forin]           # If they don\'t believe you, they will believe me',
            110000);
        }
    }],

    question: [1, 200, {
        command: function(msg, args) {
            var errors = [
                'Huh? What\'s a "' + args.join(' ') + '" supposed to be? If you can\'t type you should reconsider your profession, what about writing the next Harry Potter? *Can\'t get any worse with that...*',
                'Hold on a second, googling that for you... "' + args.join(' ') + ' did you mean *horrible typo*?" There you go!',
            ];
            msg(this.chat.thougthList[args.join(' ').toLowerCase()] || errors[Math.floor(Math.random() * errors.length)]);
        }
    }],

    jstypes: [0, 200, {
        command: function(msg, args) {
            msg('    == Comparing Types Of Objects In JavaScript ==\n\
    Don\'t use [instanceof] nor [typeof], they are both inconsistent and\n\
    [instanceof] breaks when comparing objects from two different documents.\n\
    \n\
    Use: Object.prototype.toString.call(object).slice(8, -1);\n\
    \n\
    Which gives you the Class value.\n\
    \n\
      Value               Class      Type\n\
      -------------------------------------\n\
      "foo"               String     string\n\
      new String("foo")   String     object\n\
      1.2                 Number     number\n\
      new Number(1.2)     Number     object\n\
      true                Boolean    boolean\n\
      new Boolean(true)   Boolean    object\n\
      new Date()          Date       object\n\
      new Error()         Error      object\n\
      [1,2,3]             Array      object\n\
      new Array(1, 2, 3)  Array      object\n\
      new Function("")    Function   function\n\
      /abc/g              RegExp     object (function in Nitro/V8)\n\
      new RegExp("meow")  RegExp     object (function in Nitro/V8)\n\
      {}                  Object     object\n\
      new Object()        Object     object', 111000);
        }
    }],

    jstruth: [0, 200, {
        command: function(msg, args) {
            msg('    == Equality in JavaScript ==\n\
    Always use ===, since == does type cohersion\n\
    and is slower when it does so.\n\
    The speed of === is >= the speed of ==, always.\n\
    \n\
    Truth table\n\
    ------------------------------------------\n\
      ""           ==   "0"           // false\n\
      0            ==   ""            // true\n\
      0            ==   "0"           // true\n\
      false        ==   "false"       // false\n\
      false        ==   "0"           // true\n\
      false        ==   undefined     // false\n\
      false        ==   null          // false\n\
      null         ==   undefined     // true\n\
      " \\t\\r\\n" ==   0                // true\n\
      \n\
      Note: === does what you would expect.', 111000);
        }
    }],

    jsforin: [0, 200, {
        command: function(msg, args) {
            msg('    for(x in y) is DANGEROUS, watch out if you use it.\n\
    Never rely on the order of enumeration, it is NOT guaranteed to be the same\n\
    and does in fact differ between browsers.\n\
    \n\
    Don\'t use it on normal arrays, it\'s 1000x SLOWER(!).\n\
    \n\
    Don\'t use it without the use of hasOwnProperty,\n\
    otherwise it will iterate over everything that\'s\n\
    both in the prototyp chain and happens to be enumerable.\n\
    \n\
    // Wrong\n\
    Object.prototype.foo = 1;\n\
    var obj = {"test": 1};\n\
    for(var i in obj) {\n\
        console.log(i);\n\
    }\n\
    > "test"\n\
    > "foo" // this sure will break some code!\n\
    \n\
    // Correct\n\
    for(var i in obj) {\n\
        if (obj.hasOwnProperty(i)) {\n\
            console.log(i);\n\
        }\n\
    }\n\
    > "test"', 111000);
        }
    }],

  //  Scope and Calling
  // this, closures, calling scope

    'down?': [1, 250, {
        command:  function(msg, args) {
            var srv = http.createClient(80, 'www.downforeveryoneorjustme.com');
            var req = srv.request('GET', '/' + querystring.escape(args[0]), {'Host': 'www.downforeveryoneorjustme.com'});
            req.on('response', function(res) {
                var content = '';
                res.on('data', function(chunk) {
                    content += chunk;
                });

                res.on('end', function() {
                    if (content.toString().indexOf('is up') !== -1) {
                        msg('Did you break your network? Because ' + args[0] + ' is **UP**.');

                    } else {
                        msg('What did you break this time? ' + args[0] + ' is indeed **DOWN**.');
                    }
                });
            });
            req.end();
        },
    }],

    reply: [1, 200, {
        command: function(msg, args) {
            msg('@' + args[0].user_name.replace(/\s/g, '') + ' ' + reply.create());
        }
    }],

    rchern: [0, 200, {
        $rcherns: ['oy.', 'oy', 'oy!', 'double oy', 'triple oy', '|:', '\\o/', '(:', '):', '<_<',' q:', '(;', '>_<', '^_^', 'o:'],
        command: function(msg, args) {
            msg(this.$rcherns[Math.floor(Math.random() * this.$rcherns.length)]);
        }
    }],

    quote: [0, 200, {
        $quotes: [
            ["Programming today is a race between software engineers striving to build bigger and better idiot-proof programs, and the universe trying to build bigger and better idiots. So far, the universe is winning." , "Rick Cook"],

            ["Lisp isn't a language, it's a building material." , "Alan Kay"],

            ["Walking on water and developing software from a specification are easy if both are frozen." , "Edward V Berard"],

            ["They don't make bugs like Bunny anymore." , "Olav Mjelde"],

            ["A programming language is low level when its programs require attention to the irrelevant." , "Alan J. Perlis"],

            ["A C program is like a fast dance on a newly waxed dance floor by people carrying razors." , "Waldi Ravens"],

            ["I have always wished for my computer to be as easy to use as my telephone; my wish has come true because I can no longer figure out how to use my telephone." , "Bjarne Stroustrup"],

            ["Computer science education cannot make anybody an expert programmer any more than studying brushes and pigment can make somebody an expert painter." , "Eric S. Raymond"],

            ["Don’t worry if it doesn’t work right. If everything did, you’d be out of a job." , "Mosher’s Law of Software Engineering"],

            ["I think Microsoft named .Net so it wouldn’t show up in a Unix directory listing." , "Oktal"],

            ["Fine, Java MIGHT be a good example of what a programming language should be like. But Java applications are good examples of what applications SHOULDN’T be like." , "pixadel"],

            ["Considering the current sad state of our computer programs, software development is clearly still a black art, and cannot yet be called an engineering discipline." , "Bill Clinton"],

            ["The use of COBOL cripples the mind; its teaching should therefore be regarded as a criminal offense." , "E.W. Dijkstra"],

            ["In the one and only true way. The object-oriented version of 'Spaghetti code' is, of course, 'Lasagna code'. (Too many layers)." , "Roberto Waltman"],

            ["FORTRAN is not a flower but a weed — it is hardy, occasionally blooms, and grows in every computer." , "Alan J. Perlis"],

            ["For a long time it puzzled me how something so expensive, so leading edge, could be so useless. And then it occurred to me that a computer is a stupid machine with the ability to do incredibly smart things, while computer programmers are smart people with the ability to do incredibly stupid things. They are, in short, a perfect match." , "Bill Bryson"],

            ["In My Egotistical Opinion, most people's C programs should be indented six feet downward and covered with dirt." , "Blair P. Houghton"],

            ["When someone says: 'I want a programming language in which I need only say what I wish done', give him a lollipop." , "Alan J. Perlis"],

            ["The evolution of languages: FORTRAN is a non-typed language. C is a weakly typed language. Ada is a strongly typed language. C++ is a strongly hyped language." , "Ron Sercely"],

            ["Good design adds value faster than it adds cost." , "Thomas C. Gale"],

            ["Python's a drop-in replacement for BASIC in the sense that Optimus Prime is a drop-in replacement for a truck." , "Cory Dodt"],

            ["Talk is cheap. Show me the code." , "Linus Torvalds"],

            ["Perfection [in design] is achieved, not when there is nothing more to add, but when there is nothing left to take away." , "Antoine de Saint-Exupéry"],

            ["C is quirky, flawed, and an enormous success." , "Dennis M. Ritchie"],

            ["In theory, theory and practice are the same. In practice, they’re not." , "Yoggi Berra"],

            ["You can’t have great software without a great team, and most software teams behave like dysfunctional families." , "Jim McCarthy"],

            ["PHP is a minor evil perpetrated and created by incompetent amateurs, whereas Perl is a great and insidious evil, perpetrated by skilled but perverted professionals." , "Jon Ribbens"],

            ["Programming is like kicking yourself in the face, sooner or later your nose will bleed." , "Kyle Woodbury"],

            ["Perl – The only language that looks the same before and after RSA encryption." , "Keith Bostic"],

            ["It is easier to port a shell than a shell script." , "Larry Wall"],

            ["I invented the term 'Object-Oriented', and I can tell you I did not have C++ in mind." , "Alan Kay"],

            ["Learning to program has no more to do with designing interactive software than learning to touch type has to do with writing poetry" , "Ted Nelson"],

            ["The best programmers are not marginally better than merely good ones. They are an order-of-magnitude better, measured by whatever standard: conceptual creativity, speed, ingenuity of design, or problem-solving ability." , "Randall E. Stross"],

            ["If McDonalds were run like a software company, one out of every hundred Big Macs would give you food poisoning, and the response would be, ‘We’re sorry, here’s a coupon for two more.’ " , "Mark Minasi"],

            ["Beware of bugs in the above code; I have only proved it correct, not tried it." , "Donald E. Knuth"],

            ["Computer system analysis is like child-rearing; you can do grievous damage, but you cannot ensure success." , "Tom DeMarco"],

            ["I don't care if it works on your machine! We are not shipping your machine!" , "Vidiu Platon"],

            ["Sometimes it pays to stay in bed on Monday, rather than spending the rest of the week debugging Monday's code." , "Christopher Thompson"],

            ["Measuring programming progress by lines of code is like measuring aircraft building progress by weight." , "Bill Gates"],

            ["Debugging is twice as hard as writing the code in the first place. Therefore, if you write the code as cleverly as possible, you are, by definition, not smart enough to debug it." , "Brian W. Kernighan"],

            ["People think that computer science is the art of geniuses but the actual reality is the opposite, just many people doing things that build on each other, like a wall of mini stones." , "Donald Knuth"],

            ["First learn computer science and all the theory. Next develop a programming style. Then forget all that and just hack." , "George Carrette"],

            ["Most of you are familiar with the virtues of a programmer. There are three, of course: laziness, impatience, and hubris." , "Larry Wall"],

            ["Most software today is very much like an Egyptian pyramid with millions of bricks piled on top of each other, with no structural integrity, but just done by brute force and thousands of slaves." , "Alan Kay"],

            ["The trouble with programmers is that you can never tell what a programmer is doing until it’s too late." , "Seymour Cray"],

            ["To iterate is human, to recurse divine." , "L. Peter Deutsch"],

            ["On two occasions I have been asked [by members of Parliament]: 'Pray, Mr. Babbage, if you put into the machine wrong figures, will the right answers come out?' I am not able rightly to apprehend the kind of confusion of ideas that could provoke such a question." , "Charles Babbage"],

            ["Most good programmers do programming not because they expect to get paid or get adulation by the public, but because it is fun to program." , "Linus Torvalds"],

            ["Always code as if the guy who ends up maintaining your code will be a violent psychopath who knows where you live." , "Martin Golding"],

            ["There are two ways of constructing a software design. One way is to make it so simple that there are obviously no deficiencies. And the other way is to make it so complicated that there are no obvious deficiencies." , "C.A.R. Hoare"],

            ["Some people, when confronted with a problem, think \"I know, I'll use regular expressions.\" Now they have two problems.", "Jamie Zawinski"],

            ["There are 2 hard problems in computer science: cache invalidation, naming things, and off-by-1 errors.", "Leon Bambrick"],

            ["The first 90% of the code accounts for the first 90% of the development time. The remaining 10% of the code accounts for the other 90% of the development time.", "Tom Cargill"],

            ["Nine people can't make a baby in a month.", "Fred Brooks"],

            ["If Java had true garbage collection, most programs would delete themselves upon execution.", "Robert Sewell"],

            ["There are only two kinds of languages: the ones people complain about and the ones nobody uses.", "Bjarne Stroustrup"],

            ["It's all talk until the code runs.", "Ward Cunningham"],

            ["The fool wonders, the wise man asks.", "Benjamin Disraeli"],

            ["A clever person solves a problem. A wise person avoids it.", "Albert Einstein"],

            ["Should array indices start at 0 or 1? My compromise of 0.5 was rejected without, I thought, proper consideration.", "Stan Kelly-Bootle"],

            ["Java is to JavaScript as car is to carpet.", "Chris Heilmann"],

            ["Testing can only prove the presence of bugs, not their absence.", "Edsger W. Dijkstra"],

            ["You wanted a banana but what you got was a gorilla holding the banana and the entire jungle. ", "Joe Armstrong (on object-oriented programming)"],

            ["A computer lets you make more mistakes faster than any invention in human history - with the possible exceptions of handguns and tequila.", "Mitch Ratcliffe"],

            ["Any fool can write code that a computer can understand. Good programmers write code that humans can understand.", "Martin Fowler"],

            ["The biggest obstruction to innovation is not ignorance, but the delusion of knowledge.", "Mitch Pirtle"],

            ["... one of the main causes of the fall of the Roman Empire was that, lacking zero, they had no way to indicate successful termination of their C programs.", "Robert Firth"],

            ["Why fix an old bug if you can write three new ones in the same time?", "David Kastrup"],

            ["Any sufficiently advanced technology is indistinguishable from magic.", "Arthur C. Clarke"]
        ],

        $id: -1,

        command: function(msg, args) {
            if (this.$id === -1 || this.$id === this.$quotes.length) {
                this.$quotes = this.$shuffle(this.$quotes);
                this.$id = 0;
            }
            console.log(this.$id);
            var quote = this.$quotes[this.$id];
            msg('> "' + quote[0] + '" - **' + quote[1] + '**');
            this.$id++;
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
        }
    }],

    wisdom: [1, 200, {
        command: function(msg, args) {
            this.chat.resolveUser(args.join(' '), function(id, username) {
                this.getAnswer(msg, id, username);
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

        getAnswer: function(msg, id, username) {
            var url = '/users/stats/answers?pagesize=20&userId=' + id + '&page=1&sort=votes';

            var that = this;
            this.chat.simpleRequest('GET', url).end = function(content) {
                var answers = [];
                var data = content.split('<div class="answer-summary">');

                var exp = /'\/questions(.*?)'" class="([a-z\-\s]+).*'>([0-9]+)<\/div>/i;
                for(var i = 0, l = data.length; i < l; i++) {
                    var f = exp.exec(data[i]);
                    if (f) {
                        if (f[2].indexOf('answered-accepted') !== -1 && +f[3] >= 9
                            || +f[3] >= 15) {

                            answers.push('/questions' + f[1]);
                        }
                    }
                }
                that.$shuffle(answers);

                if (answers[0]) {
                    msg('http://' + this.mainURL + answers[0], 60000);

                } else {
                    msg('Guess you\'re out of luck with ' + (username ? username : '#' + id) + '. *Yawn* I nearly fell asleep when checking their answers.');
                }
            };
        }
    }],

    wob: [0, 500, {
        $users: [['Marc Gravell', 'stackoverflow.com'],
                ['balpha', 'stackoverflow.com'],
                ['rchern', 'stackoverflow.com'],
                ['Yi Jiang', 'stackoverflow.com'],
                ['Jeff Atwood', 'stackoverflow.com'],
                ['Jin', 'stackoverflow.com'],
                ['The Server', 'stackoverflow.com'],
                // ['waffles', 'meta.stackoverflow.com'],
          //      http://meta.stackoverflow.com/users/17174/waffles
                ['badp', 'stackoverflow.com'],
                ['Michael Mrozek', 'stackoverflow.com'],
                ['Popular Demand', 'stackoverflow.com'],
                ['Nick Craver', 'stackoverflow.com']
        ],

        command: function(msg, args) {
            var user = this.$users[Math.floor(Math.random() * this.$users.length)];
            this.chat.resolveUser(user[0], function(id, username) {
                var end = 'xzs'.indexOf(username.toLowerCase().slice(-1)) !== -1 ? '\'' : 's';
                msg('**It\'s *' + username + end + '* fault**!');
                setTimeout(function() {
                    msg('http://' + user[1] + '/users/' + id + '/');
                }, 1000);
            });
        }
    }],

    join: [1, 5000, {
        command: function(msg, args) {
            var id = +args[0];
            if (!isNaN(id) && id > 0) {
                this.chat.joinRoom(id);
            }
        }
    }],

    leave: [1, 5000, {
        command: function(msg, args) {
            var id = +args[0];
            if (!isNaN(id) && id > 0 && this.chat.rooms.length > 1
                && this.chat.rooms.indexOf(id) !== -1) {

                this.chat.leaveRoom(id);
            }
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

    think: [1, 5000, {
        command: function(msg, args) {
            var text = args.slice(1).join(' ').trim();
            var id = args[0].replace(/\+/g, ' ').toLowerCase();
            if (text) {
                this.chat.thougthList[id] = text;
                msg('**' + id +'**? Sounds interesting, gonna write that down, yes on *real* paper, and no, papers\'s not edible.');

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
        var cls = Class(ChatCommand).extend(commands[i][2]);
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
            this.chat.log('[NOT ENOUGH REP]');
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

        } else {
            this.chat.log('[NOT ENOUGH ARGUMENTS]');
        }
    }
});

