/**
 * Front end source is in https://app.uyguluyo.com/signal/
 * SIGNAL
 */
const PORT = process.env.PORT || 5002
const http = require('http');
const express = require('express')
const socketIO = require('socket.io');
const app = express()
const server = http.Server(app);
const fs = require('fs');
const crypto = require('crypto');
const API_KEY = require("./.API_KEY.json");

function md5(input) {
  return crypto.createHash('md5').update(input).digest('hex');
}


// Decryption with checksum verification
function decrypt(data, password) {
  const method = 'aes-256-cbc';
  const passwordHash = crypto.createHash('sha256').update(password).digest();
  const iv = Buffer.alloc(16, 0); // 16-byte zeroed buffer
  try {
    const decipher = crypto.createDecipheriv(method, passwordHash, iv);
    let decrypted = decipher.update(data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    let checksum = decrypted.substring(0,4);
    let message  = decrypted.substring(4);
    if(crypto.createHash('md5').update(message).digest('hex').substring(0,4)==checksum){
      return message;
    }else{
      return "";
    }
  } catch (e) {
    return '';
  }
}


const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  allowEIO3: true,
  //perMessageDeflate: false,
  path: "/socket/" // Default Null
});

app.use(express.static('public'))


app.get("/", function(req, res){
  res.sendFile(__dirname + '/public/index.html');
})


app.all("/ping", function(req, res){
  res.json( req.query.v ? req.query.v : "pong" );
})

app.all("/control", function(req, res){
  res.send( decrypt(req.query.token, API) );
})

function LOG(text){
  //fs.appendFileSync('log.txt', text + "\n");
}


//^ PRIVATE ROOM
const namespace = io.of(/\/private:([0-9a-zA-Z\-\_]+):([0-9a-zA-Z\-\_]+)$/)
namespace.on("connection", function (socket) {
  let user;
  function ready(){


    let nsp = socket.nsp
    function room(){
      nsp.fetchSockets().then(sockets=>{
        let users = sockets.map(socket=>(socket.USER));
        users = users.filter(e=>e!=null)
        nsp.emit("room", users ); 
      })
    }
  
    room()
    nsp.emit("join", {"source":socket.id,"user":socket.USER}); 
  
    socket.on("message", function ({to, data}) {
      nsp.to(to).emit("message", {"source": socket.id, "data": data})
    })
  
    socket.on("broadcast", function(data){
      nsp.emit("message",{"source":socket.id, "data":data})
    })
  
    socket.on("test",function(){
      socket.emit("message",(new Date()).toUTCString())
    })

    
    socket.on("disconnect", function () {
      room()
    })

    socket.on("kick", function(user){
      if(!socket.POWER) return;   
      let room = "/socket/private:" + socket.APP + ":" + socket.ROOM  
      let count = 0;
      io.of(room).fetchSockets().then(sockets=>sockets.map(soc=>{
        socket.emit("info",soc.USER);
        if(soc.USER.user_nick==user.user_nick){
          socket.emit("success",{kicked:soc.id})
          soc.disconnect(true);
        }
        
        if( Object.entries(user).every((a)=>{ soc.USER[a[0]]==a[1] }) ){
          socket.emit("find",soc.USER);
          //socket.emit("success",{kicked:soc.id})
          //soc.disconnect(true);
        }
      }))
    })
  
    socket.on("disconnect", function () {
      room()
    })
  }
  
  
  socket.on("pass",function(pass){
    let decode = md5( API_KEY + ":" + socket.APP );
    let parsed = decrypt(pass, decode);
    if(parsed=="") return socket.emit("info","[AUTH PROBLEM]");
    user = JSON.parse(parsed)
    if(Date.now()-user.TIME>10*1000 /* 10 second */) return socket.disconnect(); //@ 10 saniye gecikme durumunda sunucudan kopar
  
    if(user.ROOM!=socket.ROOM) return
    
    socket.USER = user;
    socket.USER.ID = socket.id
    socket.POWER = user.POWER || false;
    ready();
  })
  
  socket.ROOM = socket.nsp.name.split(/^\/socket\//).join("").split(":")[2]
  socket.APP  = socket.nsp.name.split(/^\/socket\//).join("").split(":")[1]
  socket.emit("waiting",socket.ROOM);
})





//^ PUBLIC ROOM
const publicNameSpace = io.of(/\/public:([0-9a-zA-Z\-\_])+$/)
publicNameSpace.on("connection", function (socket) {
  let user,nick;
  function ready(){
    let nsp = socket.nsp
    function room(){
      nsp.fetchSockets().then(sockets=>{
        let users = sockets.filter(socket=>socket.USER!=null)
        users = users.map(socket=>({id:socket.id,user:socket.USER}));
        nsp.emit("room", users ); 
      })
    }
  
    room()
    nsp.emit("join", {"source":socket.id,"user":socket.USER}); 
  
    socket.on("message", function ({to, data}) {
      nsp.to(to).emit("message", {"source": socket.id, "data": data})
    })
  
    socket.on("broadcast", function(data){
      nsp.emit("message",{"source":socket.id, "data":data})
    })
  
    socket.on("test",function(){
      socket.emit("message",(new Date()).toUTCString())
    })

    
    socket.on("disconnect", function () {
      room()
    })
  }
  
  
  socket.on("pass",function(user){
    socket.emit("info",user)
    let room = socket.nsp.name.split(/^\/socket\//).join("");
    socket.emit("info",room)
    socket.USER = user
    socket.ROOM = room
    ready();
  })
  
  socket.emit("waiting");  
})




//^ LISTEN ROOM
const listenNamespace = io.of(/\/listen:([0-9a-zA-Z\-\_]+):([0-9a-zA-Z\-\_]+)$/)
listenNamespace.on("connection", function (socket) {
  let user;
  function ready(){ 
    socket.emit("join",user)
    socket.on("message", function ({to, data}) {
      let decode = md5( API_KEY + ":" + socket.APP );
      let parsed = decrypt(to, decode);
      data = decrypt(data,decode)
      if(parsed!="" && data!=""){
        let room = "/socket/listen:" + socket.APP + ":" + socket.ROOM  
        io.of(room).fetchSockets().then(sockets=>sockets.map(soc=>{
          if(soc.USER && soc.USER.id==parsed){
            soc.emit("message", {"source": 0, "data": data})
          }
        }))
      }
    })
    
    socket.on("test",function(){
      socket.emit("message",(new Date()).toUTCString())
    })
  
  }
  
  
  socket.on("pass",function(pass){
    let decode = md5( API_KEY + ":" + socket.APP );
    let parsed = decrypt(pass, decode);
    if(parsed=="") return socket.emit("info","[AUTH PROBLEM]");
    user = JSON.parse(parsed)
    
    if(Date.now()-user.TIME>10*1000 /* 10 second */) return socket.disconnect(); //@ 10 saniye gecikme durumunda sunucudan kopar
  
    if(user.ROOM!=socket.ROOM) return
    
    socket.USER = user;
    socket.USER.ID = socket.id
    socket.POWER = user.POWER || false;
    ready();
  })
  
  socket.ROOM = socket.nsp.name.split(/^\/socket\//).join("").split(":")[2]
  socket.APP  = socket.nsp.name.split(/^\/socket\//).join("").split(":")[1]
  socket.emit("waiting",socket.ROOM);
})


server.listen(PORT, e => {
  console.log("Sunucu Çalıştı", PORT)
})
