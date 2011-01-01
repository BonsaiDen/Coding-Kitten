CodingKitten | SO Chatbot
=========================

### Getting it up and running

 1. Use Node 3.2 (Don't pull latest Master since there's not HTTPS support atm)
 2. Get the `neko` module via npm.
 3. Get an MyOpenID Account
 4. Use that Account to register at SO
 5. Create a file called `config`

    {
        "name": "<OpenID Username>",
        "secret": "OpenID Password",
        "user": "<SO Username> (the one in the URL)",
        "userID": <SO UserID>,
        "site": "stackoverflow.com", // base site
        "rooms": [] // list of room IDs the kitten shall join at startup
    }

 6. Save the file and run `chat.js`
 7. Complain on the SO Chat that it isn't working
