//jshint esversion:6
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const http=require('http');
const {generateMessage} = require('./util/message.js');
const {generateCode} = require('./util/code.js');
const socketIO=require('socket.io');
const {Users}=require('./util/users.js');
const mongoose = require("mongoose");
const session = require('express-session');
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");

const app = express();

app.set('view engine', 'ejs');
let server=http.createServer(app);
let io=socketIO(server);
app.use(bodyParser.urlencoded({extended: true}));
app.use(express.static("public"));



app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("", {useNewUrlParser: true});
mongoose.set("useCreateIndex", true);

const userSchema = new mongoose.Schema ({
  name:String,
  email: String,
  password: String,
  googleId: String,
 type: String
});

userSchema.plugin(passportLocalMongoose);

const User = new mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});




let users= new Users();


app.get("/",function(req,res){
  if(req.isAuthenticated()){
    res.render("index",{islog: "true",name: req.user.name.split(" ")[0]});

  }else{
    res.render("index",{islog: "false",name: ""});

  }
});
app.get("/login", function(req, res){
  if(req.isAuthenticated())
  res.redirect("/");
  else
  res.render("login",{error:""});
});

app.get("/login/:name",function(req,res){

  res.render('404');
});

app.get("/register", function(req, res){
  if(req.isAuthenticated())
  res.redirect("/");
  else
  res.render("register",{error: ""});
});

app.get("/register/:name",function(req,res){
  res.render('404');
});

app.get('/premium',function(req,res){
  if(req.isAuthenticated())
  res.render("premium");
  else
  res.redirect('/login');
});

app.get("/:name",function(req,res){
var name=req.params.name;
if(name.trim()==null){
  res.redirect('/');
}else{
  if(req.isAuthenticated()){
    res.render("home",{islog: 'true',name: req.user.name.split(" ")[0]});

  }else{
    res.render("home",{islog: 'false',name: ""});

  }
}
});


app.post("/register", function(req, res){

  User.findOne({
      username: req.body.username.toLowerCase(),

    },function(err,founditems){
      if(founditems){
        res.render("register",{error: "User already exists, please login"});

      }else{
        User.register({username: req.body.username.toLowerCase(),name:req.body.name}, req.body.password, function(err, user){
          if (err) {
            res.render("register",{error: err});
          } else {
            passport.authenticate("local")(req, res, function(){
              res.redirect("/login");
            });
          }
        });
      }
    });




});

app.post("/login", function(req, res){

  const user = new User({
    username: req.body.username.toLowerCase(),
    password: req.body.password
  });

  User.findOne({
      username: req.body.username.toLowerCase(),

    },function(err,founditems){
 if(err){
   res.render("login",{error: err});
 }else if(!founditems){
   res.render("login",{error: "Please register to continue"});

 }else{
   req.login(user, function(err){
     if (err) {
       alert(err);
       res.render("login",{error:err});
     } else {
       passport.authenticate("local")(req, res, function(){

         res.redirect("/");
       });
     }
   });
 }

    });




});

var map = {};

//do not touch, its an art
io.on('connection', function(socket){


    socket.on('join',(ob,callback)=>{
    if(ob!=null){
      socket.join(ob[1].toString());
      users.removeUser(socket.id);
      users.addUser(socket.id,'User',ob[1].toString());


      io.to(ob[1]).emit('updateUsersList',users.getUserList(ob[1].toString()));
      socket.emit('newMessage',generateMessage('ADMIN',"Welcome User"));

        let user=users.getUser(socket.id);
        if(map[user.room]!=undefined)
          io.to(user.room).emit('newCode',generateCode(map[user.room]));
        }else{
            io.to(user.room).emit('newCode',generateCode(""));
        }

  });


    socket.on('createCode',function(message){

      let user=users.getUser(socket.id);
      if(user){
        if(message.text!=undefined){
          map[user.room] = message.text;
        io.to(user.room).emit('newCode',generateCode(message.text));
        }
      }
    });


    socket.on('createMessage',function(message){
      let user=users.getUser(socket.id);
      if(user){
        io.in(user.room).emit('newMessage',generateMessage(message.from,message.text));
      }
    });



  socket.on('disconnect', function(reason){
    let user=users.removeUser(socket.id);
 if(user){
   io.to(user.room).emit('updateUsersList',users.getUserList(user.room));
 }
  });
});

app.use((req,res,next)=>{
  res.send("404");

});
server.listen(process.env.PORT||3000,function(){
  console.log("server is started on port 3000");
});
