
const Signal = function(options){
  let signal = {}
  signal.room = []
  Signal.emitter(signal)
  signal.options = options
  Object.defineProperty(signal,"id",{get:()=>signal.socket.id})
  signal.socket = io(options.server, {
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnection: false,
    //query: query,
    path: (new URL(options.server)).pathname,
    transports: ["websocket"],
    //perMessageDeflate: false
  });
  signal.socket.on("connect",function(){
    signal.emit("connect")
  })
  signal.socket.onAny(function (event, data) {
    console.log("Signal:On",{event, data});
    if(event=="room"){
      //@ if not here create one
      for(let i=0;i<data.length;i++){
        let u = data[i]
        var has = signal.room.some(e=>e.id==u.id)
        if(has){

        }else{
          signal.emit("userConnect",u)
          signal.room.push(u)
        }
      }
      //@ if room inside user not in here erase
      for(let i=signal.room.length-1;i--;i>-1){
        var has = data.some(e=>e.id == signal.room[i].id)
        if(!has){
          signal.emit("userDisconnect",signal.room.splice(i,1)[0])
          
        }
      }

    }
    if(event=="message"){
      let user = signal.room.find(e=>e.id==data.source)
      data.user = user.user
      signal.emit("message",data)
    }
  });
  signal.socket.on("waiting",()=>{
    if(typeof(signal.options.user)!="function"){
      signal.socket.emit("pass",signal.options.user)
    }else{
      signal.options.user().then(user=>{
        signal.socket.emit("pass",user)
      })
    }
  })

  signal.test = function(){
    signal.socket.emit("test",console.log)
  }

  signal.broadcast = function(data){
    signal.socket.emit("broadcast",data)
  }

  signal.message = function(data, target){
    let id = target;
    if( typeof(target)!="string" && target.id ){
      id = target.id
    }
    signal.socket.emit("message",{to:target,data:data})
  }

  //@ping test
  setInterval(()=>{

  })

  return signal
}





Signal.emitter = function (obj) {
  let triggers = [];
  obj.any = function (process, order=0) {
    triggers.push({
      event:"",
      process,
      order,
      type: 'any'
    });
  }
  obj.on = function (event, process, order=0) {
    triggers.push({
      event,
      process,
      order,
      type: 'on'
    });
  }
  obj.one = function (event, process, order=0) {
    triggers.push({
      event, 
      process,
      order,
      type: 'once'
    });
  }
  obj.emit = function (event, ...args) {
    for (let i=0; i<triggers.length ; i++) {
      const trigger = triggers[i]
      if (trigger.event == event && trigger.type!="any") {
        trigger.process.apply(obj, args);
        if (trigger.type == 'once') {
          triggers.splice(triggers.indexOf(trigger), 1);
          i--;
        }
      }
      if(trigger.type=="any"){
        trigger.process.apply(obj, [event,...args] );
      }
    }
  }
}


