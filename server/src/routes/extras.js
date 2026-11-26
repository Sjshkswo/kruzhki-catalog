const router=require('express').Router();const pool=require('../db/pool');const {auth,requireRole}=require('../middleware/auth');
router.post('/organizer-application',auth,requireRole('parent'),async(req,res)=>{const {org_name,bin,phone,social_url}=req.body;if(!org_name||!phone|| (bin && !/^\d{12}$/.test(bin)))return res.status(400).json({error:'Проверьте название организации, БИН/ИИН и телефон'});const {rows}=await pool.query(`INSERT INTO organizer_applications(user_id,org_name,bin,phone,social_url) VALUES($1,$2,$3,$4,$5) RETURNING id,status`,[req.user.id,org_name.trim(),bin||null,phone,social_url||null]);res.status(201).json(rows[0]);});
router.get('/favorites',auth,async(req,res)=>{const {rows}=await pool.query('SELECT c.id,c.title,c.description,c.price,c.address FROM favorites f JOIN clubs c ON c.id=f.club_id WHERE f.user_id=$1 AND c.is_active=TRUE AND c.moderation_status=\'approved\'',[req.user.id]);res.json(rows);});
router.post('/favorites/:clubId',auth,async(req,res)=>{await pool.query('INSERT INTO favorites(user_id,club_id) SELECT $1,id FROM clubs WHERE id=$2 ON CONFLICT DO NOTHING',[req.user.id,req.params.clubId]);res.json({ok:true});});
router.delete('/favorites/:clubId',auth,async(req,res)=>{await pool.query('DELETE FROM favorites WHERE user_id=$1 AND club_id=$2',[req.user.id,req.params.clubId]);res.json({ok:true});});
router.post('/clubs/:id/reviews',auth,requireRole('parent'),async(req,res)=>{const {rating,text}=req.body;if(!Number.isInteger(rating)||rating<1||rating>5||typeof text!=='string'||text.trim().length<10||text.trim().length>1000)return res.status(400).json({error:'Оценка 1–5, текст 10–1000 символов'});const eligible=await pool.query("SELECT 1 FROM registrations WHERE club_id=$1 AND user_id=$2 AND status='confirmed' AND decided_at <= now()-interval '14 days' LIMIT 1",[req.params.id,req.user.id]);if(!eligible.rowCount)return res.status(403).json({error:'Отзыв доступен после подтверждённого участия не менее 14 дней'});try{const {rows}=await pool.query('INSERT INTO reviews(club_id,user_id,rating,text) VALUES($1,$2,$3,$4) RETURNING *',[req.params.id,req.user.id,rating,text.trim()]);res.status(201).json(rows[0]);}catch(e){if(e.code==='23505')return res.status(409).json({error:'Отзыв уже существует, его можно отредактировать'});throw e;}});
router.put('/clubs/:id/reviews',auth,requireRole('parent'),async(req,res)=>{const {rating,text}=req.body;if(!Number.isInteger(rating)||rating<1||rating>5||typeof text!=='string'||text.trim().length<10||text.trim().length>1000)return res.status(400).json({error:'Неверная оценка или текст'});const {rows}=await pool.query('UPDATE reviews SET rating=$1,text=$2 WHERE club_id=$3 AND user_id=$4 RETURNING *',[rating,text.trim(),req.params.id,req.user.id]);if(!rows[0])return res.status(404).json({error:'Отзыв не найден'});res.json(rows[0]);});
router.post('/clubs/:id/reviews/:reviewId/reply',auth,requireRole('organizer'),async(req,res)=>{const {text}=req.body;if(typeof text!=='string'||!text.trim()||text.length>1000)return res.status(400).json({error:'Неверный ответ'});const {rows}=await pool.query(`UPDATE reviews r SET organizer_reply=$1 FROM clubs c WHERE r.id=$2 AND r.club_id=c.id AND c.id=$3 AND c.organizer_id=$4 AND r.organizer_reply IS NULL RETURNING r.*`,[text.trim(),req.params.reviewId,req.params.id,req.user.id]);if(!rows[0])return res.status(409).json({error:'Ответ уже дан или отзыв не найден'});res.json(rows[0]);});
router.get('/notifications',auth,async(req,res)=>{
 const {rows}=await pool.query('SELECT id,type,title,message,link,is_read,created_at FROM notifications WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50',[req.user.id]);
 res.json(rows);
});
router.patch('/notifications/read-all',auth,async(req,res)=>{
 await pool.query('UPDATE notifications SET is_read=TRUE WHERE user_id=$1 AND is_read=FALSE',[req.user.id]);
 res.json({ok:true});
});
router.patch('/notifications/:id/read',auth,async(req,res)=>{
 const {rows}=await pool.query('UPDATE notifications SET is_read=TRUE WHERE id=$1 AND user_id=$2 RETURNING id',[req.params.id,req.user.id]);
 if(!rows[0])return res.status(404).json({error:'Уведомление не найдено'});
 res.json(rows[0]);
});
module.exports=router;
