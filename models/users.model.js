const mongoose=require("mongoose");

const userSchema=new mongoose.Schema({
    firstname:{type:String,required:true},
    lastname:{type:String,required:true},
    email:{type:String,required:true},
    password:{type:String,required:true},
    gender:{type:String,required:true},
    goal:{type:String,required:true},
    height:{type:String,required:true},
    weight:{type:String,required:true},
    dob:{type:String,required:true},
    firebase_uid:{type:String,required:true},
    is_subscribed:{type:Boolean,default:false}
},{timestamps:true});

const USERS=mongoose.model("USERS",userSchema);

module.exports=USERS;