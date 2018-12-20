var http = require('http'),
    httpProxy = require('http-proxy');
const express = require('express')
const app = express()
//
// Create a proxy server with latency
//
var proxy = httpProxy.createProxyServer({
  auth:'admin:demopassword',
  ignorePath:true
});

//
// Create your server that makes an operation that waits a while
// and then proxies the request
//

app.get("/pic/*",(req,res ) => {
  console.log(req.url);
  console.log(req.url.split("pic/")[1]);
  proxy.web(req, res,{
    target: 'http://localhost:5984/'+req.url.split("pic/")[1]
  });
})




http.createServer({}, app)
.listen(8080,()=>console.log('DINGSDA API listening on port '+ 8080));

/*
http.createServer(function (req, res) {
    proxy.web(req, res, {
      target: 'http://localhost:5984/',
      auth:'admin:demopassword'
    });
}).listen(8008);


*/
//
// Create your target server
/*
http.createServer(function (req, res) {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.write('request successfully proxied to: ' + req.url + '\n' + JSON.stringify(req.headers, true, 2));
  res.end();
}).listen(9008);
*/
