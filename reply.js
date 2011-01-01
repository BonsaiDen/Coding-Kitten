// YiJiangs horrible talking code
// TODO(for YiJiang): FIX THIS(!)

var words = [], map = [], minLength = 3;

// Normalization function to make sure all functions see the same thing
function normalize(string){
    return string ? string.trim().toLowerCase().replace(/\s,;.*!()'"-_{}[]/, '') : '';
}

// Returns a random word from the
function findRandom(string, last){
	var w = [],
		n = words.length - 2;

	string = normalize(string);

	if(!last) n += 2;

	for(var i = 0; i < n; i++){
		for(var j = 0; j < words[i].length; j++){
			if(string === normalize(words[i][j])){
				w.push({
					text: words[i][j],
					msg: i,
					word: j
				});
			}
		}
	}
	//console.log(w, w.length);
	return w[Math.floor(w.length * Math.random())];
}

function occurance(string){
	string = normalize(string);

	for(var i = 0; i < map.length; i++){
		if(map[i].text === string) return map[i].n;
	}
}

function shuffle(array) {
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


exports.init = function(messages) {
    words = shuffle(messages.slice());

    for(var i = 0; i < words.length; i++){
        words[i] = words[i].split(/[\s]+/i);
    }

    // Create map of number of occurances for each word
    for(var i = 0; i < words.length; i++){
	    for(var l = 0; l < words[i].length; l++){
		    var found = false;
		    for(var j = 0; j < map.length; j++){
			    if(map[j].text === normalize(words[i][l])){
				    map[j].n++;
				    found = true;

				    break;
			    }
		    }

		    if(!found){
			    map.push({
				    text: normalize(words[i][l]),
				    n: 1
			    });
		    }
	    }
    }

    map.sort(function(a, b){
        return b.n - a.n;
    });
}

// Parses the messages, filtering out onebox containing ones
exports.create = function(messages) {
    var currentMsg, currentWord, text = [];

    // Starting Generation action
    do {
	    do {
		    currentMsg = Math.floor(words.length * Math.random());
		    var message = words[currentMsg];
		    text[0] = message[0];

	    } while(message.length < minLength - 1); // Min length for first sentence

	    currentWord = 0;

	    // Keep going
	    var i = 0,
		    l = 0,
		    switches = 0;

	    do {
		    // If the current word is out of bounds, look for new one
		    if(typeof words[currentMsg][currentWord] === 'undefined'){
			    currentMsg = Math.floor(words.length * Math.random());
			    currentWord = 0;
		    }

		    // The chances of switching sentence increases as the more words from a single sentence is used
		    if(occurance(text[i]) > 5 && Math.random() + (l / 8) > 0.9){
			    var nextWord = findRandom(words[currentMsg][currentWord], (i >= minLength));
			    currentWord = nextWord.word + 1;
			    currentMsg = nextWord.msg;

			    text.push(words[currentMsg][currentWord]);

			    l = 0,
			    switches++;

		    } else {
			    text.push(words[currentMsg][++currentWord]);
		    }

		    i++;
		    l++;

	    } while(i < minLength || currentWord + 1 <= words[currentMsg].length);

	    // If the sentence is not a combination of more than n
	    // (usually only 0, to prevent repeats), do not use
    } while(switches === 0);
    return text.join(' ').replace(/\!kitten|kitten/gi, '');
}
