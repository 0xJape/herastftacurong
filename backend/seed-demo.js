import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const db=new DatabaseSync(path.join(root,'hera.db'));
const demoDevice='DEMO-SEED';
const demoNote='[DEMO] Analytics preview';

if(process.argv.includes('--clean')){
  db.exec('BEGIN');
  try {
    const clean={
      readings:db.prepare('DELETE FROM sensor_readings WHERE device_id = ?').run(demoDevice).changes,
      checkins:db.prepare('DELETE FROM daily_checkins WHERE notes = ?').run(demoNote).changes,
      cycles:db.prepare('DELETE FROM menstrual_cycles WHERE notes = ?').run(demoNote).changes
    };
    db.exec('COMMIT');
    console.log(JSON.stringify(clean));
  } catch(error) {
    db.exec('ROLLBACK');
    throw error;
  }
  db.close();
  process.exit();
}

const end=new Date('2026-08-19T12:00:00Z');
const isoDay=offset=>new Date(end.getTime()+offset*86400000).toISOString().slice(0,10);
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const symptoms=['cramps','headache','bloating','fatigue','nausea','breast-tenderness','back-pain'];
const insertCheckin=db.prepare(`INSERT OR IGNORE INTO daily_checkins
  (user_id,checkin_date,mood,stress,energy,sleep,hydration,symptoms,notes,created_at,updated_at)
  VALUES (1,@date,@mood,@stress,@energy,@sleep,@hydration,@symptoms,@notes,@at,@at)`);
const insertReading=db.prepare(`INSERT INTO sensor_readings
  (device_id,wearing,heart_rate,heart_rate_valid,spo2,activity,movement_level,uptime_ms,received_at)
  VALUES (@deviceId,1,@heartRate,1,@spo2,@activity,@movementLevel,@uptimeMs,@receivedAt)`);
const insertCycle=db.prepare(`INSERT OR IGNORE INTO menstrual_cycles
  (user_id,start_date,end_date,notes,created_at,updated_at)
  VALUES (1,@startDate,@endDate,@notes,@at,@at)`);

const seed=()=>{
  db.exec('BEGIN');
  try {
    let checkins=0,readings=0,cycles=0;
    for(let offset=-29;offset<=0;offset++){
      const date=isoDay(offset),wave=Math.sin((offset+29)/4),at=`${date}T20:00:00.000Z`;
      const selected=[];
      if(offset%6===0)selected.push(symptoms[Math.abs(offset)%symptoms.length]);
      if(offset%9===0)selected.push('fatigue');
      checkins+=insertCheckin.run({date,mood:clamp(Math.round(3.4+wave),1,5),stress:clamp(Math.round(2.8-wave*.7),1,5),energy:clamp(Math.round(3.2+wave*.8),1,5),sleep:clamp(Math.round(3.3+Math.sin((offset+29)/5)),1,5),hydration:clamp(3+(offset%4===0?1:0),1,5),symptoms:JSON.stringify([...new Set(selected)]),notes:demoNote,at}).changes;
      for(let sample=0;sample<6;sample++){
        const active=sample>=3&&sample<=4,receivedAt=`${date}T${String(8+sample*2).padStart(2,'0')}:00:00.000Z`;
        insertReading.run({deviceId:demoDevice,heartRate:Math.round((68+wave*4+(active?18:0)+sample%2)*10)/10,spo2:Math.round((97-wave*.5-(active?.4:0))*10)/10,activity:active?'WALKING':'RESTING',movementLevel:Math.round((active?55+sample*4:8+sample+wave*2)*100)/100,uptimeMs:(offset+30)*100000+sample*1000,receivedAt});
        readings++;
      }
    }
    for(const startDate of ['2026-05-25','2026-06-22','2026-07-20']){
      const endDate=new Date(Date.parse(`${startDate}T00:00:00Z`)+4*86400000).toISOString().slice(0,10),at=`${startDate}T08:00:00.000Z`;
      cycles+=insertCycle.run({startDate,endDate,notes:demoNote,at}).changes;
    }
    db.exec('COMMIT');
    return {checkins,readings,cycles};
  } catch(error) {
    db.exec('ROLLBACK');
    throw error;
  }
};

console.log(JSON.stringify(seed()));
db.close();
