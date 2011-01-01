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

var Class = require('neko').Class;


// OpenID and SO login ---------------------------------------------------------
// -----------------------------------------------------------------------------
exports.OpenLogin = Class().extend({
    $parseCookies: function(cookies) {
        var parsed = [];
        for(var i = 0; i < cookies.length; i++) {
            var c = cookies[i].split(';');
            parsed.push(c[0]);
        }
        return parsed;
    },

    getOpenID: function() {
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
                that.getOpenIDLogin(data);
            });
        });

        this.log('[INIT] OpenID');
        req.end();
    },

    getOpenIDLogin: function(data) {
        var that = this;
        var form = querystring.stringify({'password': this.config.secret, 'user_name': this.config.name,
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
            that.onOpenIDComplete();
        });
        this.log('[LOGIN] OpenID');
        req.end(form);
    },

    onOpenIDComplete: function() {
        var that = this;
        // Uh.... I don't think this will work with anything besides SO
        var url = '/server?openid.claimed_id=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.identity=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0%2Fidentifier_select&openid.return_to=http%3A%2F%2Fstackoverflow.com%2Fusers%2Fauthenticate%2F%3Fs%3D869da063-5dcb-4fb3-8ed8-e6baafb7d6d6%26dnoa.userSuppliedIdentifier%3Dhttp%253A%252F%252Fmyopenid.com%252F&openid.realm=http%3A%2F%2Fstackoverflow.com%2Fusers%2Fauthenticate%2F&openid.mode=checkid_setup&openid.ns=http%3A%2F%2Fspecs.openid.net%2Fauth%2F2.0&openid.ns.alias3=http%3A%2F%2Fopenid.net%2Fsrv%2Fax%2F1.0&openid.alias3.if_available=alias1%2Calias2%2Calias3%2Calias4&openid.alias3.mode=fetch_request&openid.alias3.type.alias1=http%3A%2F%2Fschema.openid.net%2FnamePerson&openid.alias3.count.alias1=1&openid.alias3.type.alias2=http%3A%2F%2Fschema.openid.net%2Fcontact%2Femail&openid.alias3.count.alias2=1&openid.alias3.type.alias3=http%3A%2F%2Faxschema.org%2FnamePerson&openid.alias3.count.alias3=1&openid.alias3.type.alias4=http%3A%2F%2Faxschema.org%2Fcontact%2Femail&openid.alias3.count.alias4=1';
        var openSite = http.createClient(443, 'www.myopenid.com', true);
        var req = openSite.request('GET', url,
                                   {'Host': 'www.myopenid.com',
                                    'Cookie': this.openIDCookie,
                                    'Origin': 'https://www.myopenid.com',
                                    'Referer': 'http://' + this.mainURL
                                                + '/users/login?returnurl=/users/'
                                                + this.config.userID + '/'
                                                + this.config.user});

        req.on('response', function (res) {
            that.log('[COMPLETE] OpenID');
            that.onExchangeLogin(res.headers.location);
        });
        this.log('[AUTH] OpenID');
        req.end();
    },

    onExchangeLogin: function(path) {
        var that = this;
        var mainHost = http.createClient(80, this.mainURL);
        var req = mainHost.request('GET', '/users' + path.split('/users')[1],
                                          {'Host': this.mainURL,
                                           'Cookie': this.exchangeCookie,
                                           'Origin': 'http://' + this.mainURL});

        req.on('response', function (res) {
            that.log('[COMPLETE] ' + that.mainURL);
            that.exchangeCookie = that.$parseCookies(res.headers['set-cookie']).join('; ') + ';';
            fs.writeFileSync('exchange.login', that.exchangeCookie);
            that.joinRooms();
        });
        this.log('[AUTH] ' + this.mainURL);
        req.end();
    }
});

