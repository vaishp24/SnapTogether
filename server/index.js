import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { nanoid } from 'nanoid';
import path from 'path';
import fs from 'fs';

const app=express(), server=http.createServer(app);
const origin=process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const io=new Server(server,{cors:{origin,methods:['GET','POST']}});
app.use(cors({origin})); app.use(express.json({limit:'15mb'}));
const uploadDir=path.resolve('server/uploads'); fs.mkdirSync(uploadDir,{recursive:true});
app.use('/uploads',express.static(uploadDir));
const storage=multer.diskStorage({destination:uploadDir,filename:(req,file,cb)=>cb(null,`${Date.now()}-${nanoid(8)}${path.extname(file.originalname)||'.jpg'}`)});
const upload=multer({storage,limits:{fileSize:12*1024*1024}});
const rooms=new Map();
const publicRoom=r=>({id:r.id,hostId:r.hostId,phase:r.phase,round:r.round,participants:[...r.participants.values()],photos:r.photos,selected:r.selected,decor:r.decor});
function emitRoom(id){const r=rooms.get(id);if(r)io.to(id).emit('room:update',publicRoom(r));}
app.get('/api/health',(req,res)=>res.json({ok:true}));
app.post('/api/rooms',(req,res)=>{const id=nanoid(7);const room={id,hostId:null,phase:'waiting',round:0,participants:new Map(),photos:[],selected:[],decor:{filter:'none',background:'#fff7f0',stickers:[],caption:''}};rooms.set(id,room);res.json({id,link:`${process.env.PUBLIC_BASE_URL||origin}/room/${id}`});});
app.get('/api/rooms/:id',(req,res)=>{const r=rooms.get(req.params.id);if(!r)return res.status(404).json({error:'Room not found'});res.json(publicRoom(r));});
app.post('/api/rooms/:id/photos',upload.single('photo'),(req,res)=>{const r=rooms.get(req.params.id);if(!r)return res.status(404).json({error:'Room not found'});if(!req.file)return res.status(400).json({error:'Photo required'});const photo={id:nanoid(10),url:`/uploads/${req.file.filename}`,participantId:req.body.participantId||'guest',name:req.body.name||'Guest',round:Number(req.body.round)||r.round,createdAt:Date.now()};r.photos.push(photo);io.to(r.id).emit('photo:new',photo);emitRoom(r.id);res.json(photo);});
app.post('/api/rooms/:id/select',(req,res)=>{const r=rooms.get(req.params.id);if(!r)return res.status(404).json({error:'Room not found'});const ids=[...new Set((req.body.ids||[]).slice(0,4))].filter(id=>r.photos.some(p=>p.id===id));r.selected=ids;emitRoom(r.id);res.json({selected:ids});});
app.post('/api/rooms/:id/decor',(req,res)=>{const r=rooms.get(req.params.id);if(!r)return res.status(404).json({error:'Room not found'});r.decor={...r.decor,...req.body};emitRoom(r.id);res.json(r.decor);});
app.post('/api/rooms/:id/email',async(req,res)=>{try{const {email,image}=req.body;if(!email||!image)return res.status(400).json({error:'Email and image required'});if(!process.env.SMTP_HOST)return res.status(503).json({error:'Email is not configured. Download the strip instead.'});const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),secure:Number(process.env.SMTP_PORT)===465,auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS}});await transporter.sendMail({from:process.env.EMAIL_FROM,to:email,subject:'Your Photo Booth strip',text:'Your friends made this photo strip together. Enjoy!',attachments:[{filename:'photo-strip.png',content:image.split(',')[1],encoding:'base64'}]});res.json({ok:true});}catch(e){res.status(500).json({error:'Could not send email.'});}});
io.on('connection',socket=>{
 socket.on('room:join',({roomId,name})=>{const r=rooms.get(roomId);if(!r){socket.emit('room:error','Room not found');return;}socket.join(roomId);const participant={id:socket.id,name:(name||'Guest').slice(0,24),joinedAt:Date.now()};r.participants.set(socket.id,participant);if(!r.hostId)r.hostId=socket.id;socket.data.roomId=roomId;socket.emit('room:joined',{participantId:socket.id,room:publicRoom(r),isHost:r.hostId===socket.id});emitRoom(roomId);});
 socket.on('session:start',()=>{const r=rooms.get(socket.data.roomId);if(!r||r.hostId!==socket.id)return;r.phase='shooting';r.round=1;emitRoom(r.id);io.to(r.id).emit('round:countdown',{round:1,seconds:3});});
 socket.on('round:next',()=>{const r=rooms.get(socket.data.roomId);if(!r||r.hostId!==socket.id||r.phase!=='shooting')return;if(r.round>=6){r.phase='selecting';emitRoom(r.id);return;}r.round++;emitRoom(r.id);io.to(r.id).emit('round:countdown',{round:r.round,seconds:3});});
 socket.on('session:finish',()=>{const r=rooms.get(socket.data.roomId);if(!r||r.hostId!==socket.id)return;r.phase='selecting';emitRoom(r.id);});
 socket.on('disconnect',()=>{const id=socket.data.roomId,r=rooms.get(id);if(r){r.participants.delete(socket.id);if(r.hostId===socket.id)r.hostId=r.participants.keys().next().value||null;emitRoom(id);}});
});
const port=Number(process.env.PORT||4000);server.listen(port,()=>console.log(`API/socket server on :${port}`));
