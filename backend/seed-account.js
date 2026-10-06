import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const email=process.argv[2];
const password=process.env.HERA_SEED_PASSWORD;
if(!email)throw new Error('Usage: node seed-account.js email@example.com');
if(password&&password.length<10)throw new Error('Password must be at least 10 characters');
const db=new DatabaseSync(path.join(path.dirname(fileURLToPath(import.meta.url)),'hera.db'));
const passwordHash=value=>{const salt=randomBytes(16).toString('hex');return `${salt}:${scryptSync(value,salt,64).toString('hex')}`};
let user=db.prepare('SELECT id,email FROM users WHERE email=? COLLATE NOCASE').get(email);
if(!user&&!password)throw new Error(`Account not found: ${email}. Set HERA_SEED_PASSWORD to create it.`);
if(!user){user=db.prepare('INSERT INTO users(name,email,password_hash,created_at) VALUES(?,?,?,?) RETURNING id,email').get('Alexa Memoria',email.toLowerCase(),passwordHash(password),new Date().toISOString())}
else if(password)db.prepare('UPDATE users SET password_hash=? WHERE id=?').run(passwordHash(password),user.id);
const day=offset=>{const date=new Date();date.setUTCHours(12,0,0,0);date.setUTCDate(date.getUTCDate()+offset);return date.toISOString().slice(0,10)};
const at=(date,hour=20)=>`${date}T${String(hour).padStart(2,'0')}:00:00.000Z`;
const sampleAt=(date,index)=>new Date(Date.parse(`${date}T08:00:00.000Z`)+index*30000).toISOString();
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const checkin=db.prepare(`INSERT INTO daily_checkins(user_id,checkin_date,mood,stress,energy,sleep,hydration,symptoms,notes,created_at,updated_at) VALUES(@userId,@date,@mood,@stress,@energy,@sleep,@hydration,@symptoms,@note,@created,@created) ON CONFLICT(user_id,checkin_date) DO UPDATE SET mood=excluded.mood,stress=excluded.stress,energy=excluded.energy,sleep=excluded.sleep,hydration=excluded.hydration,symptoms=excluded.symptoms,notes=excluded.notes,updated_at=excluded.updated_at`);
const sleep=db.prepare(`INSERT INTO sleep_records(user_id,sleep_date,sleep_quality,morning_restedness,sleep_onset_difficulty,nighttime_awakenings,sleep_disturbances,morning_sleepiness,bedtime,estimated_sleep_time,wake_time,schedule_consistency,notes,created_at,updated_at) VALUES(@userId,@date,@quality,@rested,@onset,@awakenings,@disturbances,@sleepiness,@bedtime,@sleepTime,@wakeTime,@consistency,@note,@created,@created) ON CONFLICT(user_id,sleep_date) DO UPDATE SET sleep_quality=excluded.sleep_quality,morning_restedness=excluded.morning_restedness,sleep_onset_difficulty=excluded.sleep_onset_difficulty,nighttime_awakenings=excluded.nighttime_awakenings,sleep_disturbances=excluded.sleep_disturbances,morning_sleepiness=excluded.morning_sleepiness,bedtime=excluded.bedtime,estimated_sleep_time=excluded.estimated_sleep_time,wake_time=excluded.wake_time,schedule_consistency=excluded.schedule_consistency,notes=excluded.notes,updated_at=excluded.updated_at`);
const water=db.prepare(`INSERT INTO daily_water_intake(user_id,intake_date,milliliters,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id,intake_date) DO UPDATE SET milliliters=excluded.milliliters,updated_at=excluded.updated_at`);
const reading=db.prepare(`INSERT INTO sensor_readings(device_id,wearing,heart_rate,heart_rate_valid,spo2,activity,movement_level,uptime_ms,received_at,user_id) VALUES(?,1,?,1,?,?,?,?,?,?)`);
const meal=db.prepare(`INSERT INTO meal_records(user_id,eaten_at,meal_type,food_name,portion_amount,portion_unit,calories,protein_g,carbs_g,fat_g,notes,source,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
const cycle=db.prepare(`INSERT INTO menstrual_cycles(user_id,start_date,end_date,notes,created_at,updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,start_date) DO UPDATE SET end_date=excluded.end_date,notes=excluded.notes,updated_at=excluded.updated_at`);
const goal=db.prepare(`INSERT INTO wellness_goals(user_id,title,metric,target_value,unit,direction,status,start_date,target_date,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
const progress=db.prepare(`INSERT OR IGNORE INTO goal_progress(goal_id,user_id,progress_date,value,note,created_at) VALUES(?,?,?,?,?,?)`);
const intervention=db.prepare(`INSERT INTO interventions(user_id,title,description,metrics_json,start_date,end_date,comparison_window_days,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`);
const feedback=db.prepare(`INSERT OR IGNORE INTO intervention_feedback(intervention_id,user_id,feedback_date,outcome,notes,created_at) VALUES(?,?,?,?,?,?)`);
const note='30-day wellness tracking history';
db.exec('BEGIN');
try{
  db.prepare("DELETE FROM sensor_readings WHERE user_id=? AND device_id IN ('DEMO-ALEXA-30D','ALEXA-HERA-30D')").run(user.id);
  db.prepare("DELETE FROM meal_records WHERE user_id=? AND notes=?").run(user.id,note);
  db.prepare("DELETE FROM menstrual_cycles WHERE user_id=? AND notes=?").run(user.id,note);
  db.prepare("DELETE FROM interventions WHERE user_id=? AND description=?").run(user.id,note);
  db.prepare("DELETE FROM wellness_goals WHERE user_id=? AND title IN ('Maintain daily energy','Daily hydration')").run(user.id);
  for(let offset=-29;offset<=0;offset++){
    const date=day(offset),index=offset+29,wave=Math.sin(index/4),created=at(date);
    checkin.run({userId:user.id,date,mood:clamp(Math.round(3.5+wave),1,5),stress:clamp(Math.round(2.7-wave*.7),1,5),energy:clamp(Math.round(3.4+wave*.8),1,5),sleep:clamp(Math.round(3.5+Math.sin(index/5)),1,5),hydration:clamp(3+(index%4===0?1:0),1,5),symptoms:JSON.stringify(index%7===0?['cramps','fatigue']:index%5===0?['headache']:[]),note,created});
    sleep.run({userId:user.id,date,quality:clamp(Math.round(3.6+wave*.7),1,5),rested:clamp(Math.round(3.5+wave*.8),1,5),onset:index%6===0?3:2,awakenings:index%8===0?2:1,disturbances:index%7===0?3:2,sleepiness:clamp(Math.round(2.5-wave*.6),1,5),bedtime:'22:30',sleepTime:'23:00',wakeTime:'06:45',consistency:index%5===0?4:5,note,created});
    water.run(user.id,date,1800+(index%5)*150,created);
    for(let sample=0;sample<=120;sample++){const active=sample>=40&&sample<70,light=sample>=20&&sample<40;reading.run('ALEXA-HERA-30D',Math.round((68+wave*3+(active?20:light?8:0))*10)/10,Math.round((97.5-wave*.3)*10)/10,active?'WALKING':light?'LIGHT':'RESTING',active?64:light?30:9,index*4000000+sample*30000,sampleAt(date,sample),user.id)}
    for(const [hour,type,food,calories,protein,carbs,fat] of [[8,'breakfast','Oats, banana, and egg',410,18,58,12],[13,'lunch','Rice, grilled fish, and vegetables',620,35,78,18],[19,'dinner','Chicken soup, rice, and fruit',540,31,65,16]])meal.run(user.id,at(date,hour),type,food,1,'serving',calories,protein,carbs,fat,note,'account',created,created);
  }
  for(const startOffset of [-141,-113,-84,-56,-28]){const start=day(startOffset),end=day(startOffset+4);cycle.run(user.id,start,end,note,at(start,8),at(start,8))}
  const start=day(-29),end=day(0),created=new Date().toISOString();
  const energyGoal=goal.run(user.id,'Maintain daily energy','energy',4,'rating','at-least','active',start,end,created,created).lastInsertRowid;
  const hydrationGoal=goal.run(user.id,'Daily hydration','hydration',4,'rating','at-least','active',start,end,created,created).lastInsertRowid;
  for(let offset=-29;offset<=0;offset++){const date=day(offset),index=offset+29;progress.run(energyGoal,user.id,date,clamp(Math.round(3.4+Math.sin(index/4)*.8),1,5),note,at(date));progress.run(hydrationGoal,user.id,date,3+(index%4===0?1:0),note,at(date))}
  const interventionId=intervention.run(user.id,'Consistent bedtime',note,JSON.stringify(['sleep-wellness','wellness']),start,end,7,'completed',created,created).lastInsertRowid;
  for(const offset of [-21,-14,-7,0])feedback.run(interventionId,user.id,day(offset),offset<0?'helpful':'neutral',note,at(day(offset)));
  db.exec('COMMIT');
  console.log(JSON.stringify({email:user.email,userId:user.id,days:30,checkins:30,sleepRecords:30,waterDays:30,wearableReadings:3630,wearMinutesPerDay:60,meals:90,cycles:5,cycleIntervals:[28,29,28,28],goals:2,interventions:1}));
}catch(error){db.exec('ROLLBACK');throw error}finally{db.close()}
