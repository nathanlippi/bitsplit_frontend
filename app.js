var express = require('express');
var app     = express();
var favicon = require('serve-favicon');
var path    = require("path");

var server  = require("http").createServer(app);
var io      = require("socket.io").listen(server);

var jade_values = {socket_address: '"https://bitsplit.it:443"'};

app.get('/', function(req, res) {
  res.render("index.jade", jade_values);
});

// Will catch any route without a dot, and map it to a jade file, if it exists.
app.get(/^\/([^.]*)$/, function(req, res) {
  var file = req.params[0]+".jade";

  res.render(file, jade_values, function(err, html) {
    if (err) { return res.render('404'); }

    res.send(html);
  });
});

app.use(favicon(path.join(
  __dirname, "public", "images", "favicon.ico")));
app.use(express.static(__dirname + '/public'));

app.set('view engine', 'jade');
app.set('views', __dirname + '/public/views');

var port = 3001;
server.listen(port);
console.log("App listening on port "+port);
