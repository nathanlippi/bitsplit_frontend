var express = require('express');
var app     = express();
var server  = require("http").createServer(app);

app.get('/', function(req, res) {
  res.render("index1.jade");
});

// Will catch any route without a dot, and map it to a jade file, if it exists.
app.get(/^\/([^.]*)$/, function(req, res) {
  var file = req.params[0]+".jade";

  res.render(file, function(err, html) {
    if (err) {
        return res.render('404');
    }
    res.send(html);
  });
});

app.configure(function() {
  app.use(express.static(__dirname + '/public'));

  app.set('view engine', 'jade');
  app.set('view options', { pretty: true });
  app.set('views', __dirname + '/public/views');
});

server.listen(3001);
