//jshint esversion:6

//===========Import modules=========================================

require('dotenv').config()
const express = require('express')
const bodyParser = require('body-parser')
const ejs = require('ejs');
const mongoose = require('mongoose')
const session = require('express-session')
const passport = require('passport')
const passportLocalMongoose = require('passport-local-mongoose')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const findOrCreate = require('mongoose-findorcreate')


//==========Create app==============================================

const app = express();


//==========Set app=================================================

app.use(express.static("public"));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
    secret: "My big secret is here",
    resave: false,
    saveUninitialized: false
}))

app.use(passport.initialize());
app.use(passport.session());


//===========Connect mongoose=======================================

mongoose.connect("mongodb://localhost:27017/userDB", {
    useNewUrlParser: true, 
    useUnifiedTopology: true
});

mongoose.set("useCreateIndex", true);


//=========Create Schema============================================

const userSchema = new mongoose.Schema ({
    email: String,
    password: String,
    googleId: String, 
    secret: String
});


//=========Add plugins==============================================

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);


//=========Create Model=============================================

const User = new mongoose.model("User", userSchema);


//=========Set passport=============================================

passport.use(User.createStrategy());

passport.serializeUser((user, done) => {
    done(null, user.id)
});

passport.deserializeUser((id, done) => {
    User.findById(id, (err, user) => {
        done(err, user)
    });
});


passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets"
    },
    function(accessToken, refreshToken, profile, cb) {
        console.log(profile);
        User.findOrCreate({ googleId: profile.id }, function (err, user) {
            return cb(err, user);
        });
    }
));

//==================================================================



//===========Routes=================================================

app.get("/", (req, res) => {
    res.render("home")
})

app.get("/login", (req, res) => {
    res.render("login")
})

app.get("/register", (req, res) => {
    res.render("register")
})

app.get("/secrets", (req, res) => {
    User.find({"secret": {$ne: null}}, (err, foundUsers) => {
        if(err) {
            console.log(err);
        }
        else {
            if(foundUsers) {
                res.render("secrets", {usersWithSecrets: foundUsers})
            }
        }
    })
})

app.get("/submit", (req, res) => {
    if(req.isAuthenticated()) {
        res.render("submit")
    }
    else {
        res.redirect("/login")
    }
})

app.post("/submit", (req, res) => {
    const submittedSecret = req.body.secret;

    const id = req.user.id
    User.findById(id, (err, foundUser) => {
        if(err) {
            console.log(err);
        }
        else {
            if(foundUser) {
                foundUser.secret = submittedSecret
                foundUser.save(() => {
                    res.redirect("/secrets")
                })
            }
        }
    })
})
//============Sign in with route====================================

app.get("/auth/google",
    passport.authenticate("google", { scope: ['profile'] })
)

app.get("/auth/google/secrets",
    passport.authenticate('google', {failureRedirect: "/login"}),
    (req, res) => {
        res.redirect("/secrets")
    })


//==========Manual login and sign up================================

app.post("/register", (req, res) => {

    User.register({username: req.body.username}, req.body.password, (err, user) => {
        if(err) {
            console.log(err);
            res.redirect("/register");
        }
        else {
            passport.authenticate("local")(req, res, () => {
                res.redirect("/secrets");
            })
        }
    })
})

app.post("/login", (req, res) => {
    
    const user = new User ({
        username: req.body.username,
        password: req.body.password
    });
    
    req.login(user, (err) => {
        if(err) {
            console.log(err);
        }
        else {
            passport.authenticate("local")(req, res, () => {
                res.redirect("/secrets")
            })
        }
    })
});


//========Logout====================================================

app.get("/logout", (req, res) => {
    req.logout();
    res.redirect("/");
})


//==================================================================


//=============Start server=========================================

app.listen(3000, () => {
    console.log("Server started at port 3000");
})